import { ChevronDown, SlidersHorizontal, Sparkles, Sprout } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ICON } from '../../shared/icon'
import { ALL_TAGS, tagsFor, TAG_DOTS, TAG_STYLES, type PlantTag } from '../../lib/plants'
import type { Product } from '../../lib/types'
import type { PlantFiltersState as Filters } from './usePlantFilters'

// Рамка є завжди (у вибраного — того ж кольору, що й фон), тож кнопка не «стрибає» при виборі.
const chip = (on: boolean) =>
  `inline-flex min-h-10 items-center gap-2 rounded-full border-2 py-1.5 pr-1.5 pl-4 text-sm font-bold transition-colors ${
    on ? 'border-brand-600 bg-brand-600 text-sand-50' : 'border-sand-200 bg-sand-50 text-ink hover:border-brand-500'
  }`

/** Варіант, з яким разом із уже вибраним фільтром нічого не знайдеться, — блідий (але натиснути можна). */
const dim = (on: boolean, n?: number) => (!on && !n ? 'opacity-45' : '')

/** Кількість — окремим маленьким кружечком, щоб не зливалася з назвою («Aeonium 1»). */
// Кружечок є завжди (і з нулем) і однакової ширини — тож при виборі фільтра змінюються лише цифри,
// а кнопки не перестрибують на інші рядки.
function Count({ n = 0, on }: { n?: number; on: boolean }) {
  return (
    <span
      className={`inline-flex h-6 w-7 items-center justify-center rounded-full text-[11px] font-bold tabular-nums transition-colors ${
        on ? 'bg-brand-700 text-sand-100' : 'bg-sand-200 text-sand-700'
      }`}
    >
      {n}
    </span>
  )
}

/**
 * Фільтри за видом і особливістю. Згорнуті за замовчуванням (видів може бути багато) — зверху кнопка
 * «Фільтри» з кількістю вибраних і підсумком («Echeveria · Variegata»); натиснув — панель розгортається.
 * Показує лише ті види, які реально є серед товарів категорії, з кількістю.
 */
export function PlantFilters({ products, filters, category }: { products: Product[]; filters: Filters; category: string }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  // Список видів — з усіх товарів категорії, а кількість — з урахуванням вибраної особливості (і навпаки):
  // вибрали Aeonium — біля Variegata стоїть, скільки саме варієгатних еоніумів.
  const genera = [...new Set(products.map((p) => p.genus).filter((g): g is string => !!g))].sort()
  const genusCounts = new Map<string, number>()
  for (const p of products) {
    if (p.genus && (!filters.tag || p.tags?.includes(filters.tag))) genusCounts.set(p.genus, (genusCounts.get(p.genus) ?? 0) + 1)
  }
  const tagCounts = new Map<PlantTag, number>()
  for (const p of products) {
    if (filters.genus && p.genus !== filters.genus) continue
    for (const tag of p.tags ?? []) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
  }
  // Теги категорії показуємо завжди (рослини — Зріз і форми, горщики й інструменти — Б/У),
  // навіть якщо зараз таких товарів немає.
  const tags = tagsFor(category)

  if (genera.length === 0 && tags.length === 0) return null

  const summary = [filters.genus, filters.tag && t(`tags.${filters.tag}`)].filter(Boolean).join(' · ')

  return (
    <div className="rounded-3xl border-2 border-sand-200 bg-sand-50/60">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls="plant-filters"
        className="flex min-h-12 w-full items-center gap-3 rounded-3xl px-4 py-2.5 text-left font-bold transition-colors hover:bg-sand-200/60"
      >
        <SlidersHorizontal {...ICON} className="text-brand-600" />
        {t('catalog.filters')}
        {filters.activeCount > 0 && (
          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-brand-600 px-1.5 text-xs text-sand-50">
            {filters.activeCount}
          </span>
        )}
        {summary && <span className="min-w-0 truncate text-sm font-medium text-sand-700 italic">{summary}</span>}
        <ChevronDown {...ICON} className={`ml-auto shrink-0 text-brand-600 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Плавне розгортання: висота анімується через grid-rows 0fr → 1fr */}
      <div
        id="plant-filters"
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
      >
        <div className="overflow-hidden" inert={!open}>
          <div className="space-y-3 px-4 pt-1 pb-4">
      {genera.length > 0 && (
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-sm font-bold text-sand-700">
            <Sprout size={16} strokeWidth={2.25} aria-hidden />
            {t('catalog.genus')}
          </p>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => filters.setGenus('')} className={`${chip(!filters.genus)} pr-4`} aria-pressed={!filters.genus}>
              {t('catalog.allGenera')}
            </button>
            {genera.map((g) => {
              const on = filters.genus === g
              return (
                <button key={g} onClick={() => filters.setGenus(g)} className={`${chip(on)} ${dim(on, genusCounts.get(g))}`} aria-pressed={on}>
                  {/* Латинські назви родів — курсивом, як прийнято в ботаніці */}
                  <span className="italic">{g}</span>
                  <Count n={genusCounts.get(g)} on={on} />
                </button>
              )
            })}
          </div>
        </div>
      )}
      {tags.length > 0 && (
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-sm font-bold text-sand-700">
            <Sparkles size={16} strokeWidth={2.25} aria-hidden />
            {t('catalog.filterTags')}
          </p>
          {/* Особливість — лише одна (як перемикач): вибір іншої замінює попередню */}
          <div className="flex flex-wrap gap-2">
            <button onClick={() => filters.tag && filters.setTag(filters.tag)} className={`${chip(!filters.tag)} pr-4`} aria-pressed={!filters.tag}>
              {t('catalog.allGenera')}
            </button>
            {tags.map((tag) => {
              const on = filters.tag === tag
              return (
                <button key={tag} onClick={() => filters.setTag(tag)} className={`${chip(on)} ${dim(on, tagCounts.get(tag))}`} aria-pressed={on}>
                  {/* Кружечок того ж кольору, що й бейдж тегу на картці товару — так легше зв'язати фільтр із карткою */}
                  <span className={`h-2.5 w-2.5 rounded-full ${TAG_DOTS[tag]} ${on ? 'ring-2 ring-sand-50' : ''}`} aria-hidden="true" />
                  {t(`tags.${tag}`)}
                  <Count n={tagCounts.get(tag)} on={on} />
                </button>
              )
            })}
          </div>
        </div>
      )}
          </div>
        </div>
      </div>
    </div>
  )
}

/** Маленькі бейджі тегів для картки й сторінки товару. */
export function TagBadges({ tags, className = '' }: { tags?: PlantTag[]; className?: string }) {
  const { t } = useTranslation()
  if (!tags || tags.length === 0) return null
  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {ALL_TAGS.filter((tag) => tags.includes(tag)).map((tag) => (
        <span key={tag} className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${TAG_STYLES[tag]}`}>
          {t(`tags.${tag}`)}
        </span>
      ))}
    </div>
  )
}

