import { useMutation, useQueryClient } from '@tanstack/react-query'
import { doc, serverTimestamp, writeBatch } from 'firebase/firestore'
import { ArrowRight, FileSpreadsheet, Quote, SearchCheck, Sparkles, SpellCheck } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { db } from '../../firebase/config'
import type { Product } from '../../lib/types'
import { Button, SmallImage } from '../../shared/ui'
import { useAllProducts, useOriginChecks } from './api'
import { ImportPage } from './ImportPage'
import { TabBar, useTab } from './TabBar'
import { planFormFixes, type FormFix } from './formFixes'
import { planCultivarFixes, type CultivarFix } from './cultivarFixes'
import { planNameFixes, type Lineage, type LineageSource, type NameFix } from './nameFixes'
import { OriginsTab } from './OriginCheckPage'
import { planOriginFixes, rowFromCells } from './originCheck'

/** Firestore приймає до 500 записів за раз — ділимо з запасом. */
const CHUNK = 400

/** Записує зміни пачками; `patch` — що змінити в товарі. */
export function useApplyFixes<T extends { id: string }>(patch: (fix: T) => Record<string, unknown>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (fixes: T[]) => {
      for (let i = 0; i < fixes.length; i += CHUNK) {
        const batch = writeBatch(db)
        for (const f of fixes.slice(i, i + CHUNK)) batch.update(doc(db, 'products', f.id), { ...patch(f), updatedAt: serverTimestamp() })
        await batch.commit()
      }
      return fixes.length
    },
    onSuccess: () => queryClient.invalidateQueries(),
  })
}

const TABS = ['import', 'forms', 'names', 'cultivars', 'origins'] as const
type Tab = (typeof TABS)[number]
const TAB_ICONS = { import: FileSpreadsheet, forms: Sparkles, names: SpellCheck, cultivars: Quote, origins: SearchCheck }

/**
 * /admin/tools — «Інструменти»: зміни одразу в багатьох товарах, вкладки (?tab=…):
 * - «Імпорт з таблиці» (ImportPage.tsx) — перша, без параметра;
 * - «Форми» (forms): варієгати, кристати й монстрози стають «Відбір або мутація» від звичайної версії;
 * - «Назви батьків» (names): батьки, записані не так, як рослина в магазині (описка, лапки, регістр);
 * - «Культивари» (cultivars); «Перевірка походження» (origins, OriginCheckPage.tsx) — звірка з довідковими сайтами.
 * Спершу список «було → стане», кожен рядок можна зняти галочкою; записується лише після «Застосувати».
 */
export function FormFixesPage() {
  const { t } = useTranslation()
  const [tab, setTab] = useTab(TABS)
  const { data: products, isLoading } = useAllProducts()
  const { data: checks } = useOriginChecks()
  // Скільки рослин можна виправити на кожній вкладці — у дужках біля назви вкладки
  const counts = useMemo(
    (): Partial<Record<Tab, number>> =>
      products
        ? {
            forms: planFormFixes(products).fixes.length,
            names: planNameFixes(products, new Map(), (checks ?? []).map((c) => rowFromCells(c.cells))).length,
            cultivars: planCultivarFixes(products).length,
            origins: planOriginFixes(products, (checks ?? []).map((c) => rowFromCells(c.cells))).fixes.length,
          }
        : {},
    [products, checks],
  )

  return (
    <div className="max-w-4xl">
      <h1 className="sr-only">{t('admin.home.tools')}</h1>
      <div className="mb-4">
        <TabBar
          label={t('admin.home.tools')}
          active={tab}
          onChange={setTab}
          tabs={TABS.map((id) => ({ id, label: t(`admin.fixes.tabs.${id}`), short: t(`admin.fixes.tabsShort.${id}`), Icon: TAB_ICONS[id], count: counts[id] }))}
        />
      </div>

      {/* key: при перемиканні вкладок галочки й повідомлення «Готово» починаються заново */}
      {tab === 'import' ? (
        <ImportPage key="import" />
      ) : tab === 'origins' ? (
        <OriginsTab key="origins" />
      ) : (
        <>
          {isLoading && <p className="text-sand-700">{t('loading')}</p>}
          {products &&
            (tab === 'names' ? (
              <NamesTab key="names" products={products} />
            ) : tab === 'cultivars' ? (
              <CultivarsTab key="cultivars" products={products} />
            ) : (
              <FormsTab key="forms" products={products} />
            ))}
        </>
      )}
    </div>
  )
}

export function Hint({ children }: { children: string }) {
  return (
    <p className="mb-4 flex items-start gap-2 rounded-2xl bg-sand-100 p-4 text-sm leading-relaxed text-sand-800">
      <Sparkles size={18} strokeWidth={2.25} className="mt-0.5 shrink-0 text-sunset-600" aria-hidden />
      <span>{children}</span>
    </p>
  )
}

/**
 * Спільна частина обох вкладок: «Знайдено N», «Вибрати / зняти всі», рядки з галочками й кнопка «Застосувати».
 * Спершу нічого не вибрано: продавець сам ставить галочки на тих, кого виправити.
 * Після «Застосувати» список перераховується — у ньому лишаються невибрані рядки, а галочки знову зняті.
 */
export function FixList<T extends { id: string; slug: string; name: string; image?: string }>({
  fixes,
  apply,
  row,
  aside,
  selection,
  selectable,
  alsoChosen,
  onApplied,
}: {
  fixes: T[]
  apply: ReturnType<typeof useApplyFixes<T>>
  /** Вміст рядка; chosen — чи стоїть галочка на цій рослині */
  row: (fix: T, chosen: boolean) => React.ReactNode
  /** Кнопка праворуч у рядку (напр. «Видалити правку») — натискання не ставить галочку */
  aside?: (fix: T) => React.ReactNode
  /** Галочки рядків ззовні (коли сторінці треба знати, що вибрано) */
  selection?: [Set<string>, (s: Set<string>) => void]
  /** Чи є в рядку що вибирати галочкою рядка (немає — галочки немає) */
  selectable?: (fix: T) => boolean
  /** Рядок треба застосувати й без галочки рядка (напр. вибрано лише опис) */
  alsoChosen?: (fix: T) => boolean
  /** Після «Застосувати» — напр. зняти й інші галочки сторінки */
  onApplied?: () => void
}) {
  const { t } = useTranslation()
  // Вибрані галочками (за замовчуванням — жодного)
  const own = useState<Set<string>>(new Set())
  const [selected, setSelected] = selection ?? own
  const canSelect = (f: T) => selectable?.(f) ?? true
  const chosen = fixes.filter((f) => selected.has(f.id) || alsoChosen?.(f))
  const toggle = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }
  const pickable = fixes.filter(canSelect)
  const allChosen = pickable.length > 0 && pickable.every((f) => selected.has(f.id))
  return (
    <>
      {apply.isSuccess && <p className="rounded-xl bg-brand-100 p-3 font-bold text-brand-700">{t('admin.formFixes.done', { count: apply.data })}</p>}
      {fixes.length === 0 ? (
        <p className="font-bold text-brand-700">{t('admin.formFixes.nothing')}</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-bold">{t('admin.formFixes.found', { count: fixes.length })}</p>
            <button
              type="button"
              onClick={() => setSelected(allChosen ? new Set() : new Set(pickable.map((f) => f.id)))}
              className="text-sm font-bold text-brand-600 underline"
            >
              {allChosen ? t('admin.formFixes.selectNone') : t('admin.formFixes.selectAll')}
            </button>
          </div>
          <ul className="space-y-2">
            {fixes.map((f) => (
              <li key={f.id}>
                <label
                  className={`flex cursor-pointer items-start gap-3 rounded-2xl border-2 p-3 transition-colors ${
                    selected.has(f.id) || alsoChosen?.(f) ? 'border-brand-600 bg-brand-100/40' : 'border-sand-200 bg-sand-50 hover:border-brand-500/40'
                  }`}
                >
                  {canSelect(f) ? (
                    <input type="checkbox" checked={selected.has(f.id)} onChange={() => toggle(f.id)} className="mt-1 h-5 w-5 shrink-0 accent-brand-600" />
                  ) : (
                    <span className="w-5 shrink-0" aria-hidden />
                  )}
                  {/* Мале фото — щоб одразу було видно, про яку рослину правка */}
                  {f.image && (
                    <Link to={`/product/${f.slug}`} onClick={(e) => e.stopPropagation()} className="shrink-0">
                      <SmallImage src={f.image} alt="" className="h-14 w-14 rounded-xl object-cover" />
                    </Link>
                  )}
                  <span className="min-w-0 flex-1">
                    {/* Назва — на сторінку самої рослини (там є й «Редагувати») */}
                    <Link to={`/product/${f.slug}`} className="font-bold hover:text-brand-600" onClick={(e) => e.stopPropagation()}>
                      {f.name}
                    </Link>
                    {row(f, selected.has(f.id))}
                  </span>
                  {aside?.(f)}
                </label>
              </li>
            ))}
          </ul>
          {/* Кнопка «Застосувати» завжди під рукою: телефон — смуга над нижнім меню, комп'ютер — плаваюча внизу екрана */}
          <div className="sticky bottom-[var(--bottom-nav-h,0px)] z-30 -mx-4 border-t-2 border-sand-200 bg-sand-100/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:bottom-4 sm:mr-0 sm:ml-auto sm:w-fit sm:rounded-2xl sm:border-2 sm:bg-sand-50/95 sm:p-2 sm:shadow-lg">
            <Button onClick={() => apply.mutate(chosen, {
                onSuccess: () => {
                  setSelected(new Set())
                  onApplied?.()
                },
              })} disabled={apply.isPending || chosen.length === 0}>
              {apply.isPending
                ? t('admin.import.applying')
                : chosen.length === 0
                  ? t('admin.formFixes.chooseFirst')
                  : t('admin.formFixes.apply', { count: chosen.length })}
            </Button>
          </div>
        </>
      )}
      {apply.isError && <p className="text-red-700">{t('admin.saveError')}</p>}
    </>
  )
}

function FormsTab({ products }: { products: Product[] }) {
  const { t } = useTranslation()
  // Як збереження форми з «Відбір або мутація»: одна рослина-джерело, без ареалу; селекціонер — як у звичайної версії, якщо в форми порожньо
  const apply = useApplyFixes<FormFix>((f) => ({
    ...(f.originOk ? {} : { origin: 'cultivar', parents: [f.source], habitat: '' }),
    ...(f.breeder ? { breeder: f.breeder } : {}),
  }))
  const plan = useMemo(() => planFormFixes(products), [products])
  const before = (f: FormFix) =>
    [f.before.origin ? t(`admin.fields.origins.${f.before.origin}`) : t('admin.formFixes.noOrigin'), f.before.parents.join(' × ')]
      .filter(Boolean)
      .join(': ')
  return (
    <div className="space-y-4">
      <Hint>{t('admin.formFixes.hint')}</Hint>
      <FixList
        fixes={plan.fixes}
        apply={apply}
        row={(f) => (
          <>
            {!f.originOk && (
              <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <span className="text-sand-700 line-through">{before(f)}</span>
                <ArrowRight size={14} strokeWidth={2.5} className="shrink-0 text-sand-700" aria-hidden />
                <span className="font-bold text-brand-700">{t(f.kind === 'selection' ? 'admin.formFixes.afterSelection' : 'admin.formFixes.after', { name: f.source })}</span>
              </span>
            )}
            {f.breeder && (
              <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <span className="text-sand-700">{t('admin.formFixes.breeder')}:</span>
                <span className="font-bold text-brand-700">{f.breeder}</span>
                <span className="text-sand-700">{t('admin.formFixes.breederFrom', { name: f.source })}</span>
              </span>
            )}
            {!f.sourceInShop && <span className="mt-1 block text-xs text-sand-700">{t('admin.formFixes.notInShop')}</span>}
          </>
        )}
      />
      {plan.ok > 0 && <p className="text-sm text-sand-700">{t('admin.formFixes.ok', { count: plan.ok })}</p>}
    </div>
  )
}

function NamesTab({ products }: { products: Product[] }) {
  const { t } = useTranslation()
  // Лише батьки й походження: батьки, «Походження звичайної версії» (base), а з правилом «з інших записів» — і тип походження
  const apply = useApplyFixes<NameFix>((f) => ({
    parents: f.parents,
    ...(f.base ? { base: f.base } : {}),
    ...(f.origin ? { origin: f.origin, habitat: f.habitat ?? '' } : {}),
  }))
  const { data: checks } = useOriginChecks()
  const rows = useMemo(() => (checks ?? []).map((c) => rowFromCells(c.cells)), [checks])
  // Рослини, якої немає в магазині, але записаної по-різному: яке написання правильне (вибирає продавець)
  const [chosen, setChosen] = useState<Map<string, string>>(new Map())
  // Походження рослини записане по-різному в різних місцях: який варіант правильний
  const [lineageChosen, setLineageChosen] = useState<Map<string, string>>(new Map())
  const fixes = useMemo(() => planNameFixes(products, chosen, rows, lineageChosen), [products, chosen, rows, lineageChosen])
  const choose = (key: string, name: string) => setChosen(new Map(chosen).set(key, name))
  const lineageText = (l: Lineage | null) =>
    !l
      ? t('admin.nameFixes.notSet')
      : [t(`admin.fields.origins.${l.origin}`), l.origin === 'natural' ? l.habitat : l.parents.join(' × ')].filter(Boolean).join(': ')
  const sourceText = (s: LineageSource) => t(`admin.nameFixes.sources.${s.kind}`, { name: s.name })
  return (
    <div className="space-y-4">
      <Hint>{t('admin.nameFixes.hint')}</Hint>
      <FixList
        fixes={fixes}
        apply={apply}
        row={(f) => (
          <span className="mt-1 block space-y-1.5 text-sm">
            {f.changes.map((c) => (
              <span key={c.from} className="block">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-sand-700 line-through">{c.from}</span>
                  <ArrowRight size={14} strokeWidth={2.5} className="shrink-0 text-sand-700" aria-hidden />
                  <span className="font-bold text-brand-700">{c.to}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                      c.choices ? 'bg-sand-200 text-sand-700' : c.typo ? 'bg-sunset-100 text-sunset-600' : 'bg-sand-200 text-sand-700'
                    }`}
                  >
                    {t(c.choices ? 'admin.nameFixes.notInShop' : c.typo ? 'admin.nameFixes.typo' : 'admin.nameFixes.spelling')}
                  </span>
                </span>
                {/* Рослини в магазині немає — продавець вибирає, як правильно; вибір діє на всі рослини з цим батьком */}
                {c.choices && (
                  <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-sand-700">{t('admin.nameFixes.howRight')}</span>
                    {c.choices.map((name) => (
                      <button
                        key={name}
                        type="button"
                        aria-pressed={c.to === name}
                        onClick={() => choose(c.key, name)}
                        className={`rounded-lg border px-2 py-0.5 text-xs font-bold transition-colors ${
                          c.to === name ? 'border-brand-600 bg-brand-600 text-sand-50' : 'border-sand-300 bg-sand-100 text-sand-700 hover:border-brand-600'
                        }`}
                      >
                        {name}
                      </button>
                    ))}
                  </span>
                )}
              </span>
            ))}
            {/* Походження з інших записів: картка рослини, «Походження …» у формах, перевірка походження */}
            {f.lineage && (
              <span className="block rounded-xl bg-sand-100 px-2.5 py-2">
                <span className="block text-xs font-bold text-sand-700">
                  {t(f.lineage.target === 'base' ? 'admin.nameFixes.lineageBase' : 'admin.nameFixes.lineageCard', { name: f.lineage.plant })}
                </span>
                <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className={`text-sand-700 ${f.lineage.from ? 'line-through' : ''}`}>{lineageText(f.lineage.from)}</span>
                  <ArrowRight size={14} strokeWidth={2.5} className="shrink-0 text-sand-700" aria-hidden />
                  <span className="font-bold text-brand-700">{lineageText(f.lineage.to)}</span>
                </span>
                <span className="mt-1 block text-xs text-sand-700">
                  {t('admin.nameFixes.from')} {f.lineage.sources.map(sourceText).join('; ')}
                </span>
                {/* Записано по-різному — продавець вибирає правильний варіант; вибір діє на всі картки цієї рослини */}
                {f.lineage.variants && (
                  <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-sand-700">{t('admin.nameFixes.howRight')}</span>
                    {f.lineage.variants.map((v) => (
                      <button
                        key={v.sig}
                        type="button"
                        aria-pressed={f.lineage!.sig === v.sig}
                        title={v.sources.map(sourceText).join('; ')}
                        onClick={() => setLineageChosen(new Map(lineageChosen).set(f.lineage!.key, v.sig))}
                        className={`rounded-lg border px-2 py-0.5 text-left text-xs font-bold transition-colors ${
                          f.lineage!.sig === v.sig
                            ? 'border-brand-600 bg-brand-600 text-sand-50'
                            : 'border-sand-300 bg-sand-50 text-sand-700 hover:border-brand-600'
                        }`}
                      >
                        {lineageText(v.lineage)}
                      </button>
                    ))}
                  </span>
                )}
              </span>
            )}
          </span>
        )}
      />
    </div>
  )
}

/** «Культивари»: слово в лапках переходить у поле «Культивар» форми. Назва, батьки й походження не змінюються. */
function CultivarsTab({ products }: { products: Product[] }) {
  const { t } = useTranslation()
  const apply = useApplyFixes<CultivarFix>((f) => ({
    cultivarName: f.cultivar,
    ...(f.rename ? { 'name.uk': f.rename.name, ...(f.rename.parents ? { parents: f.rename.parents } : {}) } : {}),
  }))
  const fixes = useMemo(() => planCultivarFixes(products), [products])
  const field = (label: string, value: string) => (
    <span className="inline-flex items-center gap-1">
      <span className="text-sand-700">{label}:</span>
      <span className="font-bold text-brand-700">{value}</span>
    </span>
  )
  return (
    <div className="space-y-4">
      <Hint>{t('admin.formFixes.cultivarsHint')}</Hint>
      <FixList
        fixes={fixes}
        apply={apply}
        row={(f) => (
          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span className="text-sand-700 line-through">
              {t('admin.fields.cultivar')}: {f.before}
            </span>
            <ArrowRight size={14} strokeWidth={2.5} className="shrink-0 text-sand-700" aria-hidden />
            {field(t('admin.fields.cultivar'), f.rest)}
            <span className="text-sand-700">·</span>
            {field(t('admin.fields.selection'), f.cultivar)}
            {f.rename && (
              <span className="flex basis-full flex-wrap items-center gap-x-2">
                <span className="text-sand-700">{t('admin.formFixes.mergedQuotes')}:</span>
                <span className="font-bold text-brand-700">{f.rename.name}</span>
                {f.rename.parents && (
                  <span className="text-sand-700">
                    · {t('admin.formFixes.fromLabel')} {f.rename.parents[0]}
                  </span>
                )}
              </span>
            )}
          </span>
        )}
      />
    </div>
  )
}
