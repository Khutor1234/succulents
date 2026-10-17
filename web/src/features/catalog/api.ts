import { useQuery } from '@tanstack/react-query'
import { collection, getDocs, limit, orderBy, query, where, type QueryConstraint } from 'firebase/firestore'
import { db } from '../../firebase/config'
import type { Category, Product } from '../../lib/types'

async function fetchProducts(...constraints: QueryConstraint[]): Promise<Product[]> {
  const snap = await getDocs(query(collection(db, 'products'), where('isActive', '==', true), ...constraints))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Product)
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
