import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addDoc,
  deleteDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '../../firebase/config'
import type { Order, OrderStatus, Product } from '../../lib/types'
import { withKnownTags } from '../catalog/api'

/** Усі товари, включно з прихованими (Rules дозволяють це тільки продавцю). */
export function useAllProducts() {
  return useQuery({
    queryKey: ['admin', 'products'],
    queryFn: async () => {
      const snap = await getDocs(query(collection(db, 'products'), orderBy('createdAt', 'desc')))
      return snap.docs.map((d) => withKnownTags({ id: d.id, ...d.data() } as Product))
    },
    staleTime: 0,
  })
}

export function useProductById(id: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'product', id],
    enabled: !!id,
    queryFn: async () => {
      const snap = await getDoc(doc(db, 'products', id!))
      return snap.exists() ? withKnownTags({ id: snap.id, ...snap.data() } as Product) : null
    },
    staleTime: 0,
  })
}

export type ProductInput = Omit<Product, 'id' | 'createdAt'>

export async function isSlugTaken(slug: string, exceptId?: string): Promise<boolean> {
  const snap = await getDocs(query(collection(db, 'products'), where('slug', '==', slug), limit(2)))
  return snap.docs.some((d) => d.id !== exceptId)
}

export function useSaveProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id?: string; data: ProductInput }) => {
      if (id) {
        await updateDoc(doc(db, 'products', id), { ...data, updatedAt: serverTimestamp() })
        return id
      }
      const ref = await addDoc(collection(db, 'products'), {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      return ref.id
    },
    // Скидаємо кеш і адмінки, і вітрини, щоб зміни одразу було видно.
    onSuccess: () => queryClient.invalidateQueries(),
  })
}

export function useToggleProductActive() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      updateDoc(doc(db, 'products', id), { isActive, updatedAt: serverTimestamp() }),
    onSuccess: () => queryClient.invalidateQueries(),
  })
}

/**
 * Видаляє товар назавжди. Фото у сховищі не чіпаємо: на них посилаються вже оформлені замовлення
 * (в історії покупця й в адмінці вони мають лишитися з картинкою).
 */
export function useDeleteProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteDoc(doc(db, 'products', id)),
    onSuccess: () => queryClient.invalidateQueries(),
  })
}

export function useOrders() {
  return useQuery({
    queryKey: ['admin', 'orders'],
    queryFn: async () => {
      const snap = await getDocs(query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(200)))
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Order)
    },
    staleTime: 0,
    refetchInterval: 60_000,
  })
}

export function useUpdateOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string; status?: OrderStatus; payment?: Order['payment'] }) =>
      updateDoc(doc(db, 'orders', id), { ...patch, updatedAt: serverTimestamp() }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] }),
  })
}
