import { useSearchParams } from 'react-router'
import { ALL_TAGS, type PlantTag } from '../../lib/plants'
import type { PlantOrigin, Product } from '../../lib/types'

export const SORTS = ['new', 'price-asc', 'price-desc'] as const
export type SortOrder = (typeof SORTS)[number]

export const ORIGINS = ['natural', 'hybrid', 'cultivar'] as const

const COMPARE: Record<SortOrder, (a: Product, b: Product) => number> = {
  new: (a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0),
  'price-asc': (a, b) => a.price - b.price,
  'price-desc': (a, b) => b.price - a.price,
}

/** Походження товару. У старих товарах поле не заповнене — якщо вказані батьки, це гібрид. */
export const originOf = (p: Product): PlantOrigin | undefined => p.origin ?? (p.parents?.some(Boolean) ? 'hybrid' : undefined)

type Key = 'genus' | 'tag' | 'origin' | 'breeder'

/**
 * Фільтри й сортування зберігаються в адресі (?genus=Echeveria&tag=variegata&origin=natural&breeder=Dick%20Wright&sort=price-asc) —
 * відфільтрованим списком можна поділитись. У кожному фільтрі вибирається одне значення.
 */
export function usePlantFilters() {
  const [params, setParams] = useSearchParams()
  const genus = params.get('genus') ?? ''
  const tagParam = params.get('tag') ?? ''
  const tag: PlantTag | '' = (ALL_TAGS as readonly string[]).includes(tagParam) ? (tagParam as PlantTag) : ''
  const originParam = params.get('origin') ?? ''
  const origin: PlantOrigin | '' = (ORIGINS as readonly string[]).includes(originParam) ? (originParam as PlantOrigin) : ''
  const breeder = params.get('breeder') ?? ''
  const sortParam = params.get('sort')
  const sort: SortOrder = (SORTS as readonly string[]).includes(sortParam ?? '') ? (sortParam as SortOrder) : 'new'
  const current = { genus, tag, origin, breeder }

  function update(next: Partial<typeof current> & { sort?: SortOrder }) {
    const p = new URLSearchParams()
    const merged = { ...current, ...next }
    for (const key of ['genus', 'tag', 'origin', 'breeder'] as const) if (merged[key]) p.set(key, merged[key])
    const s = next.sort ?? sort
    if (s !== 'new') p.set('sort', s)
    setParams(p, { replace: true })
  }

  /** Чи підходить товар під усі вибрані фільтри, крім `except` (щоб порахувати варіанти саме цього фільтра). */
  const matches = (p: Product, except?: Key) =>
    (except === 'genus' || !genus || p.genus === genus) &&
    (except === 'tag' || !tag || !!p.tags?.includes(tag)) &&
    (except === 'origin' || !origin || originOf(p) === origin) &&
    (except === 'breeder' || !breeder || p.breeder === breeder)

  const activeCount = Number(!!genus) + Number(!!tag) + Number(!!origin) + Number(!!breeder)

  return {
    genus,
    tag,
    origin,
    breeder,
    sort,
    // Повторне натискання на вибране значення знімає фільтр
    setGenus: (g: string) => update({ genus: g === genus ? '' : g }),
    setTag: (t: PlantTag | '') => update({ tag: t === tag ? '' : t }),
    setOrigin: (o: PlantOrigin | '') => update({ origin: o === origin ? '' : o }),
    setBreeder: (b: string) => update({ breeder: b === breeder ? '' : b }),
    setSort: (s: SortOrder) => update({ sort: s }),
    /** Скидає фільтри, але лишає вибране сортування. */
    reset: () => update({ genus: '', tag: '', origin: '', breeder: '' }),
    matches,
    activeCount,
    active: activeCount > 0,
    /** Товари, що підходять під усі фільтри, відсортовані. */
    apply: (products: Product[]) => products.filter((p) => matches(p)).sort(COMPARE[sort]),
  }
}

export type PlantFiltersState = ReturnType<typeof usePlantFilters>
