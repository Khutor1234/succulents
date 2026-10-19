import { ArrowRight, Layers, Users, UsersRound, X, type LucideIcon } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import type { Product } from '../../lib/types'
import { nameKey } from '../../lib/plantName'
import { useAllProducts } from './api'
import { buildPedigrees } from './pedigrees'

const TABS = ['trios', 'pairs', 'forms'] as const
type Tab = (typeof TABS)[number]
const TAB_ICONS: Record<Tab, LucideIcon> = { trios: UsersRound, pairs: Users, forms: Layers }

/**
 * «Родоводи» (лише продавець): підбірки з колекції — мама × тато → дитина, один із батьків → дитина,
 * та сама рослина в різних формах. Вкладка — в адресі (?tab=pairs).
 */
export function PedigreesPage() {
  const { t } = useTranslation()
  const { data, isLoading, isError } = useAllProducts()
  const [params, setParams] = useSearchParams()
  const tab: Tab = TABS.find((x) => x === params.get('tab')) ?? 'trios'
  const [search, setSearch] = useState('')
  const all = useMemo(() => buildPedigrees(data ?? []), [data])

  const q = nameKey(search.trim())
  const has = (...ps: Product[]) => !q || ps.some((p) => nameKey(p.name.uk).includes(q))
  const trios = all.trios.filter((x) => has(x.child, ...x.parents))
  const pairs = all.pairs.filter((x) => has(x.child, x.parent))
  const forms = all.formGroups.filter((g) => has(...g.items))
  const counts: Record<Tab, number> = { trios: trios.length, pairs: pairs.length, forms: forms.length }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-extrabold text-brand-600">{t('admin.pedigrees.title')}</h1>
        <p className="mt-1 text-sand-700">{t('admin.pedigrees.intro')}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex w-full rounded-2xl bg-sand-200 p-1 sm:w-auto" role="tablist" aria-label={t('admin.pedigrees.title')}>
          {TABS.map((id) => {
            const Icon = TAB_ICONS[id]
            return (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                onClick={() => setParams(id === 'trios' ? {} : { tab: id }, { replace: true, preventScrollReset: true })}
                className={`inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl px-2 text-center text-sm leading-tight font-bold transition-colors sm:flex-none sm:px-4 ${
                  tab === id ? 'bg-brand-600 text-sand-50 shadow-sm' : 'text-sand-700 hover:text-ink'
                }`}
              >
                <Icon size={16} strokeWidth={2.25} className="hidden shrink-0 sm:block" aria-hidden />
                {t(`admin.pedigrees.tabs.${id}`)}
                {data && <span className="tabular-nums opacity-75">{counts[id]}</span>}
              </button>
            )
          })}
        </div>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          enterKeyHint="search"
          placeholder={t('admin.pedigrees.search')}
          aria-label={t('admin.pedigrees.search')}
          className="min-w-0 flex-1 basis-56 rounded-xl border-2 border-sand-200 bg-sand-50 px-3.5 py-2 focus:border-brand-500 focus:outline-none"
        />
      </div>

      <p className="text-sm text-sand-700">{t(`admin.pedigrees.hints.${tab}`)}</p>

      {isLoading && <p className="text-sand-700">{t('loading')}</p>}
      {isError && <p className="text-red-700">{t('errors.loading')}</p>}
      {data && counts[tab] === 0 && (
        <p className="rounded-3xl border-2 border-dashed border-sand-300 p-6 text-center text-sand-700">
          {q ? t('admin.pedigrees.nothingFound') : t(`admin.pedigrees.empty.${tab}`)}
        </p>
      )}

      {tab === 'trios' && (
        <ul className="grid gap-4 lg:grid-cols-2">
          {trios.map(({ child, parents }) => (
            <li key={child.id} className="rounded-3xl border-2 border-sand-200 bg-sand-50 p-3 sm:p-4">
              <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-1.5 sm:gap-2">
                <Mini p={parents[0]} />
                <Sign><X size={18} strokeWidth={2.6} aria-label="×" /></Sign>
                <Mini p={parents[1]} />
                <Sign><ArrowRight size={18} strokeWidth={2.6} aria-hidden /></Sign>
                <Mini p={child} highlight />
              </div>
            </li>
          ))}
        </ul>
      )}

      {tab === 'pairs' && (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pairs.map(({ child, parent, other }) => (
            <li key={child.id} className="rounded-3xl border-2 border-sand-200 bg-sand-50 p-3 sm:p-4">
              <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-2">
                <Mini p={parent} />
                <Sign><ArrowRight size={18} strokeWidth={2.6} aria-hidden /></Sign>
                <Mini p={child} highlight />
              </div>
              <p className="mt-2 text-sm text-sand-700">
                {other ? t('admin.pedigrees.otherParent', { name: other }) : t('admin.pedigrees.oneParent')}
              </p>
            </li>
          ))}
        </ul>
      )}

      {tab === 'forms' && (
        <ul className="space-y-4">
          {forms.map((g) => (
            <li key={g.items[0].id} className="rounded-3xl border-2 border-sand-200 bg-sand-50 p-3 sm:p-4">
              <h2 className="mb-2 font-bold">
                {g.name} <span className="font-normal text-sand-700">· {t('admin.pedigrees.formsCount', { count: g.items.length })}</span>
              </h2>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                {g.items.map((p) => (
                  <Mini key={p.id} p={p} />
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Sign({ children }: { children: ReactNode }) {
  // Знак посередині фото (фото квадратні — тож вирівнюємо по верхній частині картки)
  return <span className="mt-[calc(50%-0.75rem)] flex h-6 items-center text-sand-700 sm:mt-10">{children}</span>
}

/** Маленька картка: фото й повна назва, посилання на сторінку товару. Приховані й без залишку позначені. */
function Mini({ p, highlight }: { p: Product; highlight?: boolean }) {
  const { t } = useTranslation()
  const img = p.images?.[0]
  return (
    <Link to={`/product/${p.slug}`} className="group block min-w-0">
      <span
        className={`relative block aspect-square overflow-hidden rounded-2xl border-2 bg-sand-100 ${
          !p.isActive ? 'border-dashed border-lavender-400' : highlight ? 'border-brand-500' : 'border-transparent'
        }`}
      >
        {img ? (
          <img src={img} alt="" loading="lazy" className={`h-full w-full object-cover transition-transform group-hover:scale-105 ${p.isActive ? '' : 'opacity-80'}`} />
        ) : (
          <span className="flex h-full items-center justify-center text-xs text-sand-700">{t('admin.pedigrees.noPhoto')}</span>
        )}
        {!p.isActive && (
          <span className="absolute inset-x-1 top-1 truncate rounded-full bg-lavender-700/90 px-1.5 py-0.5 text-center text-[10px] font-bold text-sand-50">
            {t('product.hidden')}
          </span>
        )}
        {p.isActive && p.stock === 0 && (
          <span className="absolute inset-x-1 bottom-1 truncate rounded-full bg-sunset-600/90 px-1.5 py-0.5 text-center text-[10px] font-bold text-sand-50">
            {t('admin.pedigrees.noStock')}
          </span>
        )}
      </span>
      <span className="mt-1 block text-xs leading-snug font-semibold break-words group-hover:text-brand-600 sm:text-sm">{p.name.uk}</span>
    </Link>
  )
}
