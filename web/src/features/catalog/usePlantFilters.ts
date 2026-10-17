import { useSearchParams } from 'react-router'
import { ALL_TAGS, type PlantTag } from '../../lib/plants'
import type { Product } from '../../lib/types'

export const SORTS = ['new', 'price-asc', 'price-desc'] as const
export type SortOrder = (typeof SORTS)[number]

const COMPARE: Record<SortOrder, (a: Product, b: Product) => number> = {
  new: (a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0),
  'price-asc': (a, b) => a.price - b.price,
  'price-desc': (a, b) => b.price - a.price,
}

/**
 * Фільтри й сортування зберігаються в адресі (?genus=Echeveria&tag=variegata&sort=price-asc) —
 * відфільтрованим списком можна поділитись. Особливість вибирається лише одна.
 */
export function usePlantFilters() {
  const [params, setParams] = useSearchParams()
  const genus = params.get('genus') ?? ''
  const tagParam = params.get('tag') ?? ''
  const tag: PlantTag | '' = (ALL_TAGS as readonly string[]).includes(tagParam) ? (tagParam as PlantTag) : ''
  const sortParam = params.get('sort')
  const sort: SortOrder = (SORTS as readonly string[]).includes(sortParam ?? '') ? (sortParam as SortOrder) : 'new'

  function update(next: { genus?: string; tag?: PlantTag | ''; sort?: SortOrder }) {
    const p = new URLSearchParams()
    const g = next.genus ?? genus
    if (g) p.set('genus', g)
    const tg = next.tag ?? tag
    if (tg) p.set('tag', tg)
    const s = next.sort ?? sort
    if (s !== 'new') p.set('sort', s)
    setParams(p, { replace: true })
  }

  return {
    genus,
    tag,
    sort,
    setGenus: (g: string) => update({ genus: g === genus ? '' : g }),
    /** Повторне натискання на вибрану особливість знімає її. */
    setTag: (t: PlantTag) => update({ tag: t === tag ? '' : t }),
    setSort: (s: SortOrder) => update({ sort: s }),
    /** Скидає фільтри, але лишає вибране сортування. */
    reset: () => update({ genus: '', tag: '' }),
    activeCount: Number(!!genus) + Number(!!tag),
    active: !!genus || !!tag,
    /** Товар підходить, якщо збігається вид і є вибрана особливість; результат відсортовано. */
    apply: (products: Product[]) =>
      products.filter((p) => (!genus || p.genus === genus) && (!tag || p.tags?.includes(tag))).sort(COMPARE[sort]),
  }
}

export type PlantFiltersState = ReturnType<typeof usePlantFilters>
