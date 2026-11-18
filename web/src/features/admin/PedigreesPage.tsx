import { ArrowDown, ArrowRight, Layers, Network, Plus, UsersRound, X, type LucideIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { SmallImage } from '../../shared/ui'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import type { Product } from '../../lib/types'
import { nameKey } from '../../lib/plantName'
import { PLANT_CATEGORY } from '../../lib/plants'
import { useHere } from '../../shared/navigation'
import { useAllProducts } from './api'
import { buildPedigrees, type PlantNode } from './pedigrees'
import { useTab } from './TabBar'

// «Батько й дитина» прибрано: ті самі пари вже є в «Нащадках» (батько і всі його діти)
const TABS = ['trios', 'families', 'forms'] as const
type Tab = (typeof TABS)[number]
const TAB_ICONS: Record<Tab, LucideIcon> = { trios: UsersRound, families: Network, forms: Layers }
// «Нащадки»: ширина картки — однакова для рослини-батька і кожної дитини
// Розмір фото рослини — однаковий на всіх трьох вкладках (--w задано на всю сторінку «Родоводів»)
const FAMILY_CARD = 'w-(--w) shrink-0'
// У «Трійках» --w менше (задано на списку трійок) — так на комп'ютері вміщається по три трійки в ряд

/**
 * «Родоводи» — вкладка «Аналітики» (/admin/analytics?tab=pedigrees): підбірки з колекції — мама × тато → дитина,
 * рослина-батько → усі її діти, та сама рослина в різних формах. Вкладка всередині — в адресі (?view=families).
 */
export function PedigreesPage() {
  const { t } = useTranslation()
  const { data, isLoading, isError } = useAllProducts()
  const [tab, setTab] = useTab<Tab>(TABS, 'view')
  const [search, setSearch] = useState('')
  const all = useMemo(() => buildPedigrees(data ?? []), [data])

  const q = nameKey(search.trim())
  const has = (...ps: Product[]) => !q || ps.some((p) => nameKey(p.name.uk).includes(q))
  const trios = all.trios.filter((x) => !q || [x.child, ...x.parents].some((n) => nameKey(n.name).includes(q)))
  const forms = all.formGroups.filter((g) => has(...g.items))
  const families = all.families.filter((f) => has(f.parent, ...f.children.map((c) => c.child)))
  const counts: Record<Tab, number> = { trios: trios.length, families: families.length, forms: forms.length }

  return (
    // --w — розмір фото рослини на всіх вкладках: телефон / планшет / комп'ютер (найбільший — як були «Форми»)
    <div className="space-y-5 [--w:7.5rem] sm:[--w:9.5rem] lg:[--w:11rem]">
      <p className="text-sand-700">{t('admin.pedigrees.intro')}</p>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex w-full rounded-2xl bg-sand-200 p-1 sm:w-auto" role="tablist" aria-label={t('admin.pedigrees.title')}>
          {TABS.map((id) => {
            const Icon = TAB_ICONS[id]
            return (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
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

      <p className="text-sm text-sand-700">
        {t(`admin.pedigrees.hints.${tab}`)}
        {tab !== 'forms' && <span className="mt-1 block">{t('admin.pedigrees.sameFormHint')}</span>}
      </p>

      {isLoading && <p className="text-sand-700">{t('loading')}</p>}
      {isError && <p className="text-red-700">{t('errors.loading')}</p>}
      {data && counts[tab] === 0 && (
        <p className="rounded-3xl border-2 border-dashed border-sand-300 p-6 text-center text-sand-700">
          {q ? t('admin.pedigrees.nothingFound') : t(`admin.pedigrees.empty.${tab}`)}
        </p>
      )}

      {tab === 'trios' && (
        <ul className="grid gap-3 [--w:7.5rem] sm:[--w:8rem] md:grid-cols-2 xl:grid-cols-3">
          {trios.map(({ key, child, parents }) => (
            <li key={key} className="rounded-3xl border-2 border-sand-200 bg-sand-50 p-2.5">
              {/*
                Три фото однакового розміру, назва — під фото (не закриває рослину), до 2 рядків:
                батьки один під одним, дитина праворуч посередині. Змінні: --w фото, --n місце під назву, --g проміжок між батьками.
                Середина фото дитини — точно посередині між фото батьків: туди сходяться лінії.
              */}
              <div className="mx-auto grid max-w-[calc(var(--w)*2+5rem)] grid-cols-[var(--w)_minmax(2.75rem,1fr)_var(--w)] items-center [--g:0.375rem] [--n:2.5rem]">
                <div className="flex flex-col gap-(--g)">
                  <TrioNode n={parents[0]} />
                  <TrioNode n={parents[1]} />
                </div>
                <Cross />
                <TrioNode n={child} child parents={[parents[0].name, parents[1].name]} />
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Нащадки: зліва (на телефоні — зверху) рослина-батько, стрілка до її дітей */}
      {tab === 'families' && (
        <ul className="space-y-4">
          {families.map(({ parent, children }) => (
            <li key={parent.id} className="rounded-3xl border-2 border-sand-200 bg-sand-50 p-3 sm:p-4">
              {/* Батько й діти — картки однакового розміру (FAMILY_CARD) */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                <div className="self-center sm:self-start">
                  <div className={FAMILY_CARD}>
                    <Mini p={parent} highlight />
                  </div>
                  <p className="mt-1 text-xs font-bold text-sand-700">{t('admin.pedigrees.childrenCount', { count: children.length })}</p>
                </div>
                <span className="flex justify-center text-sand-700 sm:mt-12">
                  <ArrowDown size={22} strokeWidth={2.6} className="sm:hidden" aria-hidden />
                  <ArrowRight size={22} strokeWidth={2.6} className="hidden sm:block" aria-hidden />
                </span>
                <div className="flex min-w-0 flex-1 flex-wrap justify-center gap-2 sm:justify-start">
                  {children.map(({ child, other }) => (
                    <div key={child.id} className={FAMILY_CARD}>
                      <Mini p={child} />
                      {other && <span className="mt-0.5 block text-[11px] leading-snug break-words text-sand-700">{t('admin.pedigrees.withOther', { name: other })}</span>}
                    </div>
                  ))}
                </div>
              </div>
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
              <div className="flex flex-wrap gap-2">
                {g.items.map((p) => (
                  <div key={p.id} className={FAMILY_CARD}>
                    <Mini p={p} />
                  </div>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * Схрещування між фото: дві плавні лінії від середини фото батьків сходяться в кружечку «×»,
 * далі — лінія зі стрілкою до фото дитини. Займає висоту від середини першого фото до середини другого.
 */
function Cross() {
  return (
    <div className="relative self-stretch" aria-hidden>
      <div className="absolute inset-x-0 top-[calc(var(--w)/2)] h-[calc(var(--w)+var(--n)+var(--g))]">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible text-brand-500/60" fill="none">
          <path d="M0 0 C 30 0, 30 50, 50 50 M0 100 C 30 100, 30 50, 50 50 M50 50 L 96 50" stroke="currentColor" strokeWidth="2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
        {/* Наконечник стрілки — окремо, щоб не розтягувався разом з лініями */}
        <svg viewBox="0 0 10 12" className="absolute top-1/2 right-0 h-3 w-2.5 -translate-y-1/2 text-brand-500/60" fill="currentColor">
          <path d="M0 0 L10 6 L0 12 Z" />
        </svg>
        <span className="absolute top-1/2 left-1/2 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-brand-600 text-sand-50 shadow-sm ring-4 ring-sand-50">
          <X size={15} strokeWidth={3} />
        </span>
      </div>
    </div>
  )
}

/**
 * Рослина в трійці — фото (--w × --w) і назва під ним (місце --n, до 3 рядків). Дитина — у зеленій рамці.
 * Такої рослини в магазині немає — пунктирний квадрат з плюсиком «Створити картку»
 * (для дитини — одразу з походженням «Гібрид» і батьками).
 */
function TrioNode({ n, child, parents }: { n: PlantNode; child?: boolean; parents?: [string, string] }) {
  const { t } = useTranslation()
  const here = useHere()
  const p = n.product
  // Назва — під фото, на висоту --n (до 2 рядків; повна — у підказці при наведенні)
  const name = (
    <span className="mt-1 line-clamp-2 h-[calc(var(--n)-0.25rem)] text-[11px] leading-[1.05rem] font-semibold break-words group-hover:text-brand-600 sm:text-xs">
      {n.name}
    </span>
  )
  if (!p) {
    const params = new URLSearchParams({ category: PLANT_CATEGORY, name: n.name })
    if (parents) {
      params.set('origin', 'hybrid')
      params.set('p1', parents[0])
      params.set('p2', parents[1])
    }
    const label = t('search.addPlant', { name: n.name })
    return (
      <Link to={`/admin/products/new?${params}`} state={{ from: here }} title={label} aria-label={label} className="group block w-(--w) text-sand-700">
        {/* Немає в магазині: пунктирний квадрат з плюсиком і «Немає в магазині», назва — під ним */}
        <span className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-sand-300 p-1 text-center transition-colors group-hover:border-brand-500">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-sand-50 transition-transform group-hover:scale-110">
            <Plus size={18} strokeWidth={3} aria-hidden />
          </span>
          <span className="text-[10px] leading-tight font-bold sm:text-[11px]">{t('admin.pedigrees.notInShop')}</span>
        </span>
        {name}
      </Link>
    )
  }
  const img = p.images?.[0]
  return (
    <Link to={`/product/${p.slug}`} title={p.name.uk} className="group block w-(--w)">
      <span
        className={`relative block aspect-square overflow-hidden rounded-2xl border-2 bg-sand-100 ${
          !p.isActive ? 'border-dashed border-lavender-400' : child ? 'border-brand-500' : 'border-transparent'
        }`}
      >
        {img ? (
          <SmallImage src={img} alt="" className={`h-full w-full object-cover transition-transform group-hover:scale-105 ${p.isActive ? '' : 'opacity-80'}`} />
        ) : (
          <span className="flex h-full items-center justify-center text-xs text-sand-700">{t('admin.pedigrees.noPhoto')}</span>
        )}
        {!p.isActive && (
          <span className="absolute inset-x-1 top-1 truncate rounded-full bg-lavender-700/90 px-1.5 py-0.5 text-center text-[10px] font-bold text-sand-50">
            {t('product.hidden')}
          </span>
        )}
        {p.isActive && p.stock === 0 && (
          <span className="absolute inset-x-1 top-1 truncate rounded-full bg-sunset-600/90 px-1.5 py-0.5 text-center text-[10px] font-bold text-sand-50">
            {t('admin.pedigrees.noStock')}
          </span>
        )}
      </span>
      {name}
    </Link>
  )
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
