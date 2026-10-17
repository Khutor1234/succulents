import { useQuery } from '@tanstack/react-query'
import { collection, getDocs, limit, orderBy, query, where, type QueryConstraint } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { knownTags } from '../../lib/plants'
import type { Category, Product } from '../../lib/types'

/** Прибирає з товару застарілі теги (напр. колишній 'hybrid'). */
export const withKnownTags = (p: Product): Product => (p.tags ? { ...p, tags: knownTags(p.tags) } : p)

async function fetchProducts(...constraints: QueryConstraint[]): Promise<Product[]> {
  const snap = await getDocs(query(collection(db, 'products'), where('isActive', '==', true), ...constraints))
  return snap.docs.map((d) => withKnownTags({ id: d.id, ...d.data() } as Product))
}

export function useProducts(category: Category) {
  return useQuery({
    queryKey: ['products', category],
    queryFn: () => fetchProducts(where('category', '==', category), orderBy('createdAt', 'desc')),
  })
}

export function useLatestProducts(count = 8) {
  return useQuery({
    queryKey: ['products', 'latest', count],
    queryFn: () => fetchProducts(orderBy('createdAt', 'desc'), limit(count)),
  })
}

export function useProduct(slug: string) {
  return useQuery({
    queryKey: ['product', slug],
    queryFn: async () => (await fetchProducts(where('slug', '==', slug), limit(1)))[0] ?? null,
  })
}

/** Увесь видимий каталог — для пошуку (товарів сотні, тож простіше шукати прямо в браузері). */
export function useAllProducts() {
  return useQuery({
    queryKey: ['products', 'all'],
    queryFn: () => fetchProducts(),
    staleTime: 5 * 60 * 1000,
  })
}
