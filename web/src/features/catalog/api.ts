import { useQuery } from '@tanstack/react-query'
import { collection, getDocs, limit, orderBy, query, where, type QueryConstraint } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { knownTags } from '../../lib/plants'
import type { Category, Product } from '../../lib/types'

/** Прибирає з товару застарілі теги (напр. колишній 'hybrid'). */
export const withKnownTags = (p: Product): Product => (p.tags ? { ...p, tags: knownTags(p.tags) } : p)

async function fetchProducts(...constraints: QueryConstraint[]): Promise<Product[]> {
  return fetchAny(where('isActive', '==', true), ...constraints)
}

/** Без фільтра видимості — приховані товари бачить лише продавець (так дозволяють Rules). */
async function fetchAny(...constraints: QueryConstraint[]): Promise<Product[]> {
  const snap = await getDocs(query(collection(db, 'products'), ...constraints))
  return snap.docs.map((d) => withKnownTags({ id: d.id, ...d.data() } as Product))
}

const newestFirst = (a: Product, b: Product) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0)

/** `withHidden` — для продавця: разом із прихованими товарами. */
export function useProducts(category: Category, withHidden = false) {
  return useQuery({
    queryKey: ['products', category, withHidden],
    queryFn: () =>
      withHidden
        ? // Сортуємо в браузері — так не потрібен окремий індекс Firestore для «категорія + дата» без isActive
          fetchAny(where('category', '==', category)).then((list) => list.sort(newestFirst))
        : fetchProducts(where('category', '==', category), orderBy('createdAt', 'desc')),
  })
}

export function useLatestProducts(count = 8, withHidden = false) {
  return useQuery({
    queryKey: ['products', 'latest', count, withHidden],
    queryFn: () => (withHidden ? fetchAny : fetchProducts)(orderBy('createdAt', 'desc'), limit(count)),
  })
}

/** `withHidden` — для продавця: відкривається й прихований товар. */
export function useProduct(slug: string, withHidden = false) {
  return useQuery({
    queryKey: ['product', slug, withHidden],
    queryFn: async () => (await (withHidden ? fetchAny : fetchProducts)(where('slug', '==', slug), limit(1)))[0] ?? null,
  })
}

/**
 * Увесь видимий каталог — для пошуку (товарів сотні, тож простіше шукати прямо в браузері).
 * `withHidden` — для продавця: разом із прихованими товарами.
 */
export function useAllProducts(withHidden = false) {
  return useQuery({
    queryKey: ['products', 'all', withHidden],
    queryFn: () => (withHidden ? fetchAny() : fetchProducts()),
    staleTime: 5 * 60 * 1000,
  })
}
