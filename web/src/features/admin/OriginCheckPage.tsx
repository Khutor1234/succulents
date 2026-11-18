import { ArrowRight, Check, CircleCheck, ClipboardCopy, ExternalLink, Plus, Save } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { PLANT_CATEGORY } from '../../lib/plants'
import { useHere } from '../../shared/navigation'
import { nameKey } from '../../lib/plantName'
import { slugify } from '../../lib/slug'
import { Select, Textarea } from '../../shared/ui'
import { useAllProducts, useOriginChecks, useSaveOriginChecks } from './api'
import { FixList, Hint, useApplyFixes } from './FormFixesPage'
import { checkablePlants, parseCells, planOriginFixes, rowFromCells, toTsv, type CheckRow, type OriginFix } from './originCheck'

// Ще не збережена вставка лежить у браузері — не загубиться, якщо сторінку оновили
const STORAGE_KEY = 'succulents.originCheck'
// Документ перевірки — за назвою рослини: повторна перевірка тієї самої рослини перезаписує стару
const checkId = (name: string) => slugify(nameKey(name)).slice(0, 200) || 'row'

/**
 * «Перевірка походження» — вкладка «Виправити форми» (/admin/forms?tab=origins):
 * 1) список рослин роду таблицею — «Скопіювати» (його перевіряє Claude на worldofsucculents.com та інших сайтах);
 * 2) вставити результат і «Зберегти» — перевірки лишаються в базі (originChecks), повторна перевірка рослини замінює стару;
 * 3) з усіх збережених перевірок видно лише розбіжності «Було / Стане» з джерелом; записується лише вибране галочками.
 * Копіювати можна лише неперевірені рослини — напр. нові, щойно додані.
 */
export function OriginsTab() {
  const { t } = useTranslation()
  const { data: products, isLoading } = useAllProducts()
  const plants = useMemo(() => checkablePlants(products ?? []), [products])
  const genera = useMemo(() => {
    const count = new Map<string, number>()
    for (const p of plants) count.set(p.genus || '—', (count.get(p.genus || '—') ?? 0) + 1)
    return [...count].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  }, [plants])
  const { data: checks } = useOriginChecks()
  const saveChecks = useSaveOriginChecks()
  const rows = useMemo(() => (checks ?? []).map((c) => rowFromCells(c.cells)), [checks])
  const plan = useMemo(() => planOriginFixes(products ?? [], rows), [products, rows])
  const [genus, setGenus] = useState('')
  const [onlyNew, setOnlyNew] = useState(true)
  const inGenus = genus ? plants.filter((p) => (p.genus || '—') === genus) : plants
  const unchecked = inGenus.filter((p) => !plan.checked.has(p.id))
  const list = onlyNew ? unchecked : inGenus
  const [copied, setCopied] = useState(false)
  const [text, setText] = useState(() => localStorage.getItem(STORAGE_KEY) ?? '')
  const pasted = useMemo(() => parseCells(text), [text])
  const apply = useApplyFixes<OriginFix>((f) => f.patch)

  function edit(value: string) {
    setText(value)
    if (value) localStorage.setItem(STORAGE_KEY, value)
    else localStorage.removeItem(STORAGE_KEY)
  }

  async function save() {
    // Та сама рослина двічі в одній таблиці — лишається останній рядок
    const byId = new Map(pasted.map((cells) => [checkId(cells[0]), cells]))
    await saveChecks.mutateAsync([...byId].map(([id, cells]) => ({ id, cells })))
    edit('')
  }

  async function copy() {
    await navigator.clipboard.writeText(toTsv(list))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-6">
      <Hint>{t('admin.originCheck.hint')}</Hint>
      {isLoading && <p className="text-sand-700">{t('loading')}</p>}

      {products && (
        <>
          <section className="space-y-3 rounded-3xl border-2 border-sand-200 bg-sand-50 p-4">
            <h2 className="font-bold">{t('admin.originCheck.step1')}</h2>
            <div className="flex flex-wrap items-end gap-3">
              <Select label={t('catalog.genus')} current={genus} value={genus} onChange={(e) => setGenus(e.target.value)} className="min-w-48">
                <option value="">{t('admin.originCheck.allGenera', { count: plants.length })}</option>
                {genera.map(([g, n]) => (
                  <option key={g} value={g}>
                    {g} ({n})
                  </option>
                ))}
              </Select>
              <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold">
                <input type="checkbox" checked={onlyNew} onChange={(e) => setOnlyNew(e.target.checked)} className="h-5 w-5 accent-brand-600" />
                {t('admin.originCheck.onlyNew', { count: unchecked.length })}
              </label>
              <button
                type="button"
                onClick={copy}
                disabled={list.length === 0}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-600 px-4 font-bold text-sand-50 transition-colors hover:bg-brand-700 disabled:opacity-50"
              >
                {copied ? <Check size={18} strokeWidth={2.5} aria-hidden /> : <ClipboardCopy size={18} strokeWidth={2.25} aria-hidden />}
                {copied ? t('admin.originCheck.copied') : t('admin.originCheck.copy', { count: list.length })}
              </button>
            </div>
            {/* Що зараз записано — коротко, щоб було видно, що саме піде на перевірку */}
            <details>
              <summary className="cursor-pointer text-sm font-bold text-brand-600">{t('admin.originCheck.showList', { count: list.length })}</summary>
              <ul className="mt-2 divide-y divide-sand-200 text-sm">
                {list.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center gap-x-2 py-1.5">
                    {plan.checked.has(p.id) && (
                      <CircleCheck size={16} strokeWidth={2.5} className="shrink-0 text-brand-600" aria-label={t('admin.originCheck.checked')} />
                    )}
                    <span className="font-semibold">{p.name.uk}</span>
                    <span className="text-sand-700">
                      {p.origin ? t(`admin.fields.origins.${p.origin}`) : t('admin.formFixes.noOrigin')}
                      {p.origin === 'natural' ? (p.habitat ? `: ${p.habitat}` : '') : p.parents?.filter(Boolean).length ? `: ${p.parents.filter(Boolean).join(' × ')}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          </section>

          <section className="space-y-3 rounded-3xl border-2 border-sand-200 bg-sand-50 p-4">
            <h2 className="font-bold">{t('admin.originCheck.step2')}</h2>
            <Textarea
              label={t('admin.originCheck.paste')}
              value={text}
              onChange={(e) => edit(e.target.value)}
              rows={5}
              spellCheck={false}
              className="font-mono text-xs"
            />
            {text.trim() && (
              <div className="flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={save}
                  disabled={pasted.length === 0 || saveChecks.isPending}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-600 px-4 font-bold text-sand-50 transition-colors hover:bg-brand-700 disabled:opacity-50"
                >
                  <Save size={18} strokeWidth={2.25} aria-hidden />
                  {t('admin.originCheck.save', { count: pasted.length })}
                </button>
                <button type="button" onClick={() => edit('')} className="text-sm font-bold text-sand-700 underline">
                  {t('admin.originCheck.clear')}
                </button>
              </div>
            )}
            {saveChecks.isError && <p className="text-sm text-sunset-600">{t('admin.originCheck.saveError')}</p>}
            <p className="text-sm text-sand-700">{t('admin.originCheck.saved', { count: rows.length })}</p>
          </section>

          {rows.length > 0 && (
            <section className="space-y-4">
              <h2 className="font-bold">{t('admin.originCheck.step3')}</h2>
              <FixList
                fixes={plan.fixes}
                apply={apply}
                row={(f) => (
                  <span className="mt-1 block space-y-1 text-sm">
                    {f.changes.map((c) => (
                      <span key={c.field} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="text-sand-700">{t(`admin.originCheck.fields.${c.field}`)}:</span>
                        <span className="text-sand-700 line-through">{c.from || t('admin.originCheck.empty')}</span>
                        <ArrowRight size={14} strokeWidth={2.5} className="shrink-0 text-sand-700" aria-hidden />
                        <span className="font-bold text-brand-700">{c.to || t('admin.originCheck.empty')}</span>
                      </span>
                    ))}
                    {f.note && <span className="block text-xs text-sunset-600">{f.note}</span>}
                    {f.source && <SourceLink url={f.source} />}
                  </span>
                )}
              />
              {plan.ok > 0 && <p className="text-sm text-sand-700">{t('admin.originCheck.ok', { count: plan.ok })}</p>}
              {plan.unknown.length > 0 && (
                <Leftovers title={t('admin.originCheck.unknown', { count: plan.unknown.length })} rows={plan.unknown} />
              )}
              {plan.missing.length > 0 && <Missing rows={plan.missing} />}
            </section>
          )}
        </>
      )}
    </div>
  )
}

function SourceLink({ url }: { url: string }) {
  const { t } = useTranslation()
  if (!/^https?:\/\//.test(url)) return <span className="block text-xs text-sand-700">{url}</span>
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1 text-xs font-bold text-brand-600 underline"
    >
      <ExternalLink size={12} strokeWidth={2.5} aria-hidden />
      {t('admin.originCheck.source', { host: new URL(url).hostname.replace(/^www\./, '') })}
    </a>
  )
}

/** Рослини, яких не знайдено на сайтах — просто перелік із приміткою. */
function Leftovers({ title, rows }: { title: string; rows: CheckRow[] }) {
  return (
    <details className="rounded-2xl bg-sand-100 p-3">
      <summary className="cursor-pointer text-sm font-bold text-sand-800">{title}</summary>
      <ul className="mt-2 space-y-1 text-sm">
        {rows.map((r) => (
          <li key={r.name}>
            <span className="font-semibold">{r.name}</span>
            {r.note && <span className="text-sand-700"> — {r.note}</span>}
            {r.source && <SourceLink url={r.source} />}
          </li>
        ))}
      </ul>
    </details>
  )
}

/**
 * Рослини, яких у магазині немає (зазвичай батьки): що про них знайдено — походження, батьки, ареал, селекціонер —
 * і плюсик «Створити картку» з усім цим уже вписаним (картка буде прихованою, поки її не покажете).
 */
function Missing({ rows }: { rows: CheckRow[] }) {
  const { t } = useTranslation()
  const here = useHere()
  return (
    <section className="space-y-2">
      <h2 className="font-bold">{t('admin.originCheck.missing', { count: rows.length })}</h2>
      <p className="text-sm text-sand-700">{t('admin.originCheck.missingHint')}</p>
      <ul className="space-y-2">
        {rows.map((r) => {
          const name = r.fixedName || r.name
          const params = new URLSearchParams({ category: PLANT_CATEGORY, name })
          if (r.origin) params.set('origin', r.origin)
          r.parents.forEach((p, i) => params.set(`p${i + 1}`, p))
          if (r.habitat) params.set('habitat', r.habitat)
          if (r.breeder) params.set('breeder', r.breeder)
          if (r.aliases.length) params.set('aliases', r.aliases.join(', '))
          const info = [
            r.origin ? t(`admin.fields.origins.${r.origin}`) : '',
            r.origin === 'natural' ? r.habitat : r.parents.join(' × '),
            r.breeder ? `${t('admin.originCheck.fields.breeder')}: ${r.breeder}` : '',
            r.aliases.length ? `${t('admin.originCheck.fields.aliases')}: ${r.aliases.join(', ')}` : '',
          ].filter(Boolean)
          return (
            <li key={r.name} className="flex items-start gap-3 rounded-2xl border-2 border-dashed border-sand-300 bg-sand-50 p-3">
              <span className="min-w-0 flex-1 text-sm">
                <span className="block font-bold">{name}</span>
                {info.length > 0 && <span className="block text-sand-700">{info.join(' · ')}</span>}
                {r.note && <span className="block text-xs text-sunset-600">{r.note}</span>}
                {r.source && <SourceLink url={r.source} />}
              </span>
              <Link
                to={`/admin/products/new?${params}`}
                state={{ from: here }}
                title={t('search.addPlant', { name })}
                aria-label={t('search.addPlant', { name })}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sand-50 transition-transform hover:scale-110"
              >
                <Plus size={18} strokeWidth={3} aria-hidden />
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
