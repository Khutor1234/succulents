import { useMutation, useQueryClient } from '@tanstack/react-query'
import { doc, serverTimestamp, writeBatch } from 'firebase/firestore'
import { ArrowRight, Info, Pencil, Undo2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { db } from '../../firebase/config'
import type { Product } from '../../lib/types'
import { Button, SmallImage } from '../../shared/ui'
import { mergePatches, RULES, useFixPlan, type PlantSuggestions, type Rule, type Suggestion } from './allFixes'
import { useSetFixDismissal } from './api'
import { Hint } from './FormFixesPage'
import type { Lineage, LineageSource } from './nameFixes'

const RULE_STYLE: Record<Rule, string> = {
  form: 'bg-sunset-100 text-sunset-700',
  selection: 'bg-sunset-100 text-sunset-700',
  breeder: 'bg-brand-100 text-brand-700',
  aliases: 'bg-brand-100 text-brand-700',
  aliasGenus: 'bg-brand-100 text-brand-700',
  names: 'bg-sand-200 text-sand-800',
  lineage: 'bg-lavender-100 text-lavender-700',
  cultivar: 'bg-sand-200 text-sand-800',
  quotes: 'bg-sand-200 text-sand-800',
  genusField: 'bg-sunset-100 text-sunset-700',
  nameStyle: 'bg-sand-200 text-sand-800',
  formTags: 'bg-sunset-100 text-sunset-700',
  aliasSelf: 'bg-brand-100 text-brand-700',
  aliasShared: 'bg-brand-100 text-brand-700',
  selfParent: 'bg-lavender-100 text-lavender-700',
  originConflict: 'bg-lavender-100 text-lavender-700',
  habitat: 'bg-lavender-100 text-lavender-700',
  habitatSpelling: 'bg-lavender-100 text-lavender-700',
  breederSpelling: 'bg-brand-100 text-brand-700',
  breederCopied: 'bg-brand-100 text-brand-700',
  shopReady: 'bg-sand-200 text-sand-800',
  slugGenus: 'bg-sunset-100 text-sunset-700',
  quoteName: 'bg-sand-200 text-sand-800',
  originMissing: 'bg-lavender-100 text-lavender-700',
  fromSpelling: 'bg-sand-200 text-sand-800',
  speciesCase: 'bg-sand-200 text-sand-800',
}

/**
 * «Інструменти → Виправлення»: одна табличка замість вкладок «Форми», «Назви батьків» і «Культивари».
 * По кожній рослині — пропозиції за всіма правилами, кожна з поясненням, своєю галочкою й кнопкою «Неактуально».
 */
export function FixesTab({ products }: { products: Product[] }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  // Вибір правильного варіанта: як записати батька, якого немає в магазині; яке походження правильне
  const [names, setNames] = useState<Map<string, string>>(new Map())
  const [lineage, setLineage] = useState<Map<string, string>>(new Map())
  // Як правильно записати селекціонера, якщо його записано по-різному
  const [breeders, setBreeders] = useState<Map<string, string>>(new Map())
  const choices = useMemo(() => ({ names, lineage, breeders }), [names, lineage, breeders])
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])
  const { active, all } = useFixPlan(products, choices)
  const dismiss = useSetFixDismissal()
  const [rule, setRule] = useState<Rule | 'all'>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // Неактуальні лишаються на своїх місцях (сірі, без галочки); у лічильниках — лише актуальні
  const shown = (
    rule === 'all'
      ? all
      : all.map((g) => ({
          ...g,
          items: g.items.filter((s) => s.rule === rule),
        }))
  ).filter((g) => g.items.length)
  const counts = new Map<Rule, number>()
  for (const g of active) for (const s of g.items) counts.set(s.rule, (counts.get(s.rule) ?? 0) + 1)
  // Підказки без зміни (patch: null) галочки не мають — їх виправляють у картці
  const visible = shown.flatMap((g) => g.items).filter((s) => s.patch && !s.dismissed)
  const chosen = active.flatMap((g) => g.items).filter((s) => s.patch && selected.has(s.id))
  const allChosen = visible.length > 0 && visible.every((s) => selected.has(s.id))
  const toggle = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  const apply = useMutation({
    mutationFn: async (items: Suggestion[]) => {
      const byProduct = new Map<string, Suggestion[]>()
      for (const s of items) byProduct.set(s.productId, [...(byProduct.get(s.productId) ?? []), s])
      const entries = [...byProduct]
      for (let i = 0; i < entries.length; i += 400) {
        const batch = writeBatch(db)
        for (const [id, list] of entries.slice(i, i + 400))
          batch.update(doc(db, 'products', id), {
            ...mergePatches(list, byId.get(id)),
            updatedAt: serverTimestamp(),
          })
        await batch.commit()
      }
      return items.length
    },
    onSuccess: () => {
      setSelected(new Set())
      return queryClient.invalidateQueries()
    },
  })

  return (
    <div className="space-y-4">
      <Hint>{t('admin.allFixes.hint')}</Hint>

      {/* Фільтр за правилом — скільки пропозицій за кожним */}
      {all.length > 0 && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('admin.allFixes.filter')}>
          {(['all', ...RULES.filter((r) => all.some((g) => g.items.some((s) => s.rule === r)))] as const).map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={rule === r}
              onClick={() => setRule(r)}
              className={`rounded-full border px-3 py-1 text-sm font-bold transition-colors ${
                rule === r ? 'border-brand-600 bg-brand-600 text-sand-50' : 'border-sand-300 bg-sand-50 text-sand-700 hover:border-brand-600'
              }`}
            >
              {r === 'all' ? t('admin.allFixes.all') : t(`admin.allFixes.rules.${r}.label`)}{' '}
              <span className="tabular-nums opacity-80">{r === 'all' ? active.reduce((n, g) => n + g.items.length, 0) : (counts.get(r) ?? 0)}</span>
            </button>
          ))}
        </div>
      )}

      {apply.isSuccess && <p className="rounded-xl bg-brand-100 p-3 font-bold text-brand-700">{t('admin.formFixes.done', { count: apply.data })}</p>}

      {shown.length === 0 ? (
        <p className="font-bold text-brand-700">{t('admin.formFixes.nothing')}</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-bold">{t('admin.formFixes.found', { count: shown.length })}</p>
            <button
              type="button"
              onClick={() => setSelected(allChosen ? new Set() : new Set([...selected, ...visible.map((s) => s.id)]))}
              className="text-sm font-bold text-brand-600 underline"
            >
              {allChosen ? t('admin.formFixes.selectNone') : t('admin.formFixes.selectAll')}
            </button>
          </div>
          <ul className="space-y-3">
            {shown.map((g) => (
              <PlantCard key={g.id} plant={g}>
                {g.items.map((s) => (
                  <SuggestionRow
                    key={s.id}
                    s={s}
                    chosen={selected.has(s.id)}
                    onToggle={() => toggle(s.id)}
                    onChooseName={(key, name) => setNames(new Map(names).set(key, name))}
                    onChooseLineage={(key, sig) => setLineage(new Map(lineage).set(key, sig))}
                    onChooseBreeder={(key, name) => setBreeders(new Map(breeders).set(key, name))}
                    action={
                      s.dismissed ? (
                        <button
                          type="button"
                          onClick={() => dismiss.mutate({ id: s.id, sig: null })}
                          disabled={dismiss.isPending}
                          title={t('admin.allFixes.restoreHint')}
                          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-sand-300 bg-sand-50 px-2 py-1 text-xs font-bold text-sand-700 transition-colors hover:border-brand-600 hover:text-brand-700 disabled:opacity-60"
                        >
                          <Undo2 size={14} strokeWidth={2.5} aria-hidden />
                          {t('admin.allFixes.restore')}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            dismiss.mutate({ id: s.id, sig: s.sig })
                            const next = new Set(selected)
                            next.delete(s.id)
                            setSelected(next)
                          }}
                          disabled={dismiss.isPending}
                          title={t('admin.allFixes.dismissHint')}
                          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-sand-300 px-2 py-1 text-xs font-bold text-sand-700 transition-colors hover:border-sunset-600 hover:text-sunset-700 disabled:opacity-60"
                        >
                          <X size={14} strokeWidth={2.5} aria-hidden />
                          {t('admin.allFixes.dismiss')}
                        </button>
                      )
                    }
                  />
                ))}
              </PlantCard>
            ))}
          </ul>
          {/* Кнопка «Застосувати» завжди під рукою: телефон — смуга над нижнім меню, комп'ютер — плаваюча внизу екрана */}
          <div className="sticky bottom-[var(--bottom-nav-h,0px)] z-30 -mx-4 border-t-2 border-sand-200 bg-sand-100/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:bottom-4 sm:mr-0 sm:ml-auto sm:w-fit sm:rounded-2xl sm:border-2 sm:bg-sand-50/95 sm:p-2 sm:shadow-lg">
            <Button onClick={() => apply.mutate(chosen)} disabled={apply.isPending || chosen.length === 0}>
              {apply.isPending
                ? t('admin.import.applying')
                : chosen.length === 0
                  ? t('admin.allFixes.chooseFirst')
                  : t('admin.allFixes.apply', { count: chosen.length })}
            </Button>
          </div>
        </>
      )}
      {apply.isError && <p className="text-red-700">{t('admin.saveError')}</p>}
    </div>
  )
}

/** Рослина: мале фото й назва (посилання на її сторінку), під ними — пропозиції */
function PlantCard({ plant, children }: { plant: PlantSuggestions; children: React.ReactNode }) {
  return (
    <li className="rounded-2xl border-2 border-sand-200 bg-sand-50 p-3">
      <div className="flex items-center gap-3">
        {plant.image && (
          <Link to={`/product/${plant.slug}`} className="shrink-0">
            <SmallImage src={plant.image} alt="" className="h-12 w-12 rounded-xl object-cover" />
          </Link>
        )}
        <Link to={`/product/${plant.slug}`} className="min-w-0 font-bold hover:text-brand-600">
          {plant.name}
        </Link>
      </div>
      <div className="mt-2 space-y-2">{children}</div>
    </li>
  )
}

/** Одна пропозиція: галочка, правило з поясненням, «Було → Стане» і кнопка праворуч */
function SuggestionRow({
  s,
  chosen,
  onToggle,
  onChooseName,
  onChooseLineage,
  onChooseBreeder,
  action,
}: {
  s: Suggestion
  chosen?: boolean
  onToggle?: () => void
  onChooseName?: (key: string, name: string) => void
  onChooseLineage?: (key: string, sig: string) => void
  onChooseBreeder?: (key: string, name: string) => void
  action: React.ReactNode
}) {
  const { t } = useTranslation()
  const off = !!s.dismissed
  const lineageText = (l: Lineage | null) =>
    !l
      ? t('admin.nameFixes.notSet')
      : [t(`admin.fields.origins.${l.origin}`), l.origin === 'natural' ? l.habitat : l.parents.join(' × ')].filter(Boolean).join(': ')
  const sourceText = (x: LineageSource) => t(`admin.nameFixes.sources.${x.kind}`, { name: x.name })
  const arrow = <ArrowRight size={14} strokeWidth={2.5} className="shrink-0 text-sand-700" aria-hidden />
  const was = (text: string, strike = true) => <span className={`text-sand-700 ${strike ? 'line-through' : ''}`}>{text}</span>
  const will = (text: string) => <span className="font-bold text-brand-700">{text}</span>
  const pick = (on: boolean, label: string, onClick: () => void, title?: string) => (
    <button
      key={label}
      type="button"
      aria-pressed={on}
      title={title}
      onClick={onClick}
      disabled={!onClick || !onToggle}
      className={`rounded-lg border px-2 py-0.5 text-left text-xs font-bold transition-colors ${
        on ? 'border-brand-600 bg-brand-600 text-sand-50' : 'border-sand-300 bg-sand-50 text-sand-700 hover:border-brand-600'
      }`}
    >
      {label}
    </button>
  )

  // Пояснення до рядків нових правил (у даних — короткі коди, тут — зрозумілий текст)
  const noteText = (note: string): string => {
    if (s.rule === 'nameStyle')
      return `${t('admin.allFixes.notes.whatChanges')} ${note
        .split(',')
        .map((r) => t(`admin.allFixes.reasons.${r}`))
        .join(', ')}`
    if (s.rule === 'genusField') return t('admin.allFixes.notes.genusMismatch', { text: note })
    const [kind, ...rest] = note.split(':')
    if (kind === 'tags')
      return t('admin.allFixes.notes.addTags', {
        tags: rest
          .join(':')
          .split(',')
          .map((tag) => t(`tags.${tag}`))
          .join(', '),
      })
    if (kind === 'cycle') return t('admin.allFixes.notes.cycle', { name: rest.join(':') })
    if (kind === 'alias')
      return t('admin.allFixes.notes.aliasShared', {
        alias: rest[0],
        names: rest.slice(1).join(':'),
      })
    if (kind === 'breederNoCard') return t('admin.allFixes.notes.breederNoCard', { name: rest.join(':') })
    if (kind === 'breederFrom') return t('admin.allFixes.notes.breederFrom', { name: rest.join(':') })
    if (kind === 'aliasName') return t('admin.allFixes.notes.aliasName', { alias: rest.join(':') })
    return t(`admin.allFixes.notes.${note}`)
  }

  let body: React.ReactNode = null
  if (s.lines) {
    body = (
      <>
        {s.lines.map((l, i) =>
          l.note ? (
            <span key={i} className="block text-xs text-sand-700">
              {noteText(l.note)}
            </span>
          ) : (
            <Line key={i}>
              {was(l.from ?? '')}
              {arrow}
              {will(l.to === '—' ? t('admin.allFixes.removed') : l.to === 'hybrid' ? t('admin.fields.origins.hybrid') : (l.to ?? ''))}
            </Line>
          ),
        )}
        {s.choice && (
          <span className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-sand-700">{t('admin.nameFixes.howRight')}</span>
            {s.choice.options.map((o) => pick(s.choice!.value === o, o, () => onChooseBreeder?.(s.choice!.key, o)))}
          </span>
        )}
        {/* Лише підказка: автоматично не виправляється — відкрити картку товару */}
        {!s.patch && (
          <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className="inline-flex items-center gap-1 text-sand-700">
              <Info size={13} strokeWidth={2.5} aria-hidden />
              {t('admin.allFixes.infoOnly')}
            </span>
            <Link to={`/admin/products/${s.productId}`} className="inline-flex items-center gap-1 font-bold text-brand-600 underline">
              <Pencil size={13} strokeWidth={2.5} aria-hidden />
              {t('admin.allFixes.edit')}
            </Link>
          </span>
        )}
      </>
    )
  } else if ((s.rule === 'form' || s.rule === 'selection') && s.form) {
    const f = s.form
    const before = [f.before.origin ? t(`admin.fields.origins.${f.before.origin}`) : t('admin.formFixes.noOrigin'), f.before.parents.join(' × ')]
      .filter(Boolean)
      .join(': ')
    body = (
      <>
        <Line>
          {was(before)}
          {arrow}
          {will(t(s.rule === 'selection' ? 'admin.formFixes.afterSelection' : 'admin.formFixes.after', { name: f.source }))}
        </Line>
        {!f.sourceInShop && <span className="block text-xs text-sand-700">{t('admin.formFixes.notInShop')}</span>}
      </>
    )
  } else if (s.rule === 'breeder' && s.breeder) {
    body = (
      <Line>
        {was(t('admin.nameFixes.notSet'), false)}
        {arrow}
        {will(s.breeder.name)}
        <span className="text-xs text-sand-700">{t('admin.formFixes.breederFrom', { name: s.breeder.from })}</span>
      </Line>
    )
  } else if (s.rule === 'aliases' && s.aliases) {
    body = (
      <>
        <Line>
          <span className="text-sand-700">{t('admin.allFixes.addAliases')}</span>
          {will(s.aliases.add.join(', '))}
          <span className="text-xs text-sand-700">{t('admin.formFixes.breederFrom', { name: s.aliases.from })}</span>
        </Line>
        <span className="block text-xs text-sand-700">
          {t('admin.allFixes.aliasesResult')} {s.aliases.result.join(', ')}
        </span>
      </>
    )
  } else if (s.rule === 'aliasGenus' && s.aliasGenus) {
    body = (
      <>
        {s.aliasGenus.changes.map((c) => (
          <Line key={c.from}>
            {was(c.from)}
            {arrow}
            {will(c.to)}
          </Line>
        ))}
        <span className="block text-xs text-sand-700">
          {t('admin.allFixes.aliasesResult')} {s.aliasGenus.result.join(', ')}
        </span>
      </>
    )
  } else if (s.rule === 'names' && s.names) {
    body = s.names.map((c) => (
      <span key={c.from} className="block">
        <Line>
          {was(c.from)}
          {arrow}
          {will(c.to)}
          <span className="text-xs text-sand-700">
            ({t(c.choices ? 'admin.nameFixes.notInShop' : c.typo ? 'admin.nameFixes.typo' : 'admin.nameFixes.spelling')})
          </span>
        </Line>
        {c.choices && (
          <span className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-sand-700">{t('admin.nameFixes.howRight')}</span>
            {c.choices.map((n) => pick(c.to === n, n, () => onChooseName?.(c.key, n)))}
          </span>
        )}
      </span>
    ))
  } else if (s.rule === 'lineage' && s.lineage) {
    const l = s.lineage
    body = (
      <>
        <span className="block text-xs font-bold text-sand-700">
          {t(l.target === 'base' ? 'admin.nameFixes.lineageBase' : 'admin.nameFixes.lineageCard', { name: l.plant })}
        </span>
        <Line>
          {was(lineageText(l.from), !!l.from)}
          {arrow}
          {will(lineageText(l.to))}
        </Line>
        <span className="block text-xs text-sand-700">
          {t('admin.nameFixes.from')} {l.sources.map(sourceText).join('; ')}
        </span>
        {l.variants && (
          <span className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-sand-700">{t('admin.nameFixes.howRight')}</span>
            {l.variants.map((v) => pick(l.sig === v.sig, lineageText(v.lineage), () => onChooseLineage?.(l.key, v.sig), v.sources.map(sourceText).join('; ')))}
          </span>
        )}
      </>
    )
  } else if (s.rule === 'cultivar' && s.cultivar) {
    const c = s.cultivar
    body = (
      <Line>
        {was(`${t('admin.fields.cultivar')}: ${c.before}`)}
        {arrow}
        {will(`${t('admin.fields.cultivar')}: ${c.rest} · ${t('admin.fields.selection')}: ${c.cultivar}`)}
      </Line>
    )
  } else if (s.rule === 'quotes' && s.cultivar?.rename) {
    const c = s.cultivar
    body = (
      <>
        <Line>
          {was(c.name)}
          {arrow}
          {will(c.rename!.name)}
        </Line>
        {c.rename!.parents && (
          <span className="block text-xs text-sand-700">
            {t('admin.formFixes.fromLabel')} {c.rename!.parents[0]}
          </span>
        )}
      </>
    )
  }

  return (
    <div
      className={`flex items-start gap-3 rounded-xl border p-2.5 transition-colors ${
        off ? 'border-dashed border-sand-300 bg-transparent' : chosen ? 'border-brand-600 bg-brand-100/40' : 'border-sand-200 bg-sand-100/60'
      }`}
    >
      {onToggle && s.patch && !off ? (
        <input
          type="checkbox"
          checked={!!chosen}
          onChange={onToggle}
          aria-label={t(`admin.allFixes.rules.${s.rule}.label`)}
          className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-brand-600"
        />
      ) : onToggle ? (
        <span className="w-5 shrink-0" aria-hidden />
      ) : null}
      <div className={`min-w-0 flex-1 text-sm ${off ? 'opacity-50' : ''}`}>
        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${off ? 'bg-sand-200 text-sand-700' : RULE_STYLE[s.rule]}`}>
          {t(`admin.allFixes.rules.${s.rule}.label`)}
        </span>
        {off && <span className="ml-1.5 text-xs font-bold text-sand-700">· {t('admin.allFixes.dismissed')}</span>}
        {/* Чому пропонуємо — за яким правилом */}
        <span className="mt-1 block text-xs leading-relaxed text-sand-700">{t(`admin.allFixes.rules.${s.rule}.why`)}</span>
        <div className="mt-1.5 space-y-1">{body}</div>
      </div>
      {action}
    </div>
  )
}

function Line({ children }: { children: React.ReactNode }) {
  return <span className="flex flex-wrap items-center gap-x-2 gap-y-1">{children}</span>
}
