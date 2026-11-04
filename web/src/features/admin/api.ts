import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import {
  addDoc,
  deleteDoc,
  deleteField,
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

/** Запити, що показують товари: вітрина (['products'…], ['product'…]) і списки адмінки (['admin', 'products' | 'product'…]). */
export const isProductQuery = (key: readonly unknown[]) =>
  key[0] === 'products' || key[0] === 'product' || (key[0] === 'admin' && (key[1] === 'products' || key[1] === 'product'))

/**
 * Швидкі дії продавця на картці (кількість, показати, у продаж, видалити) змінюють один товар — тож не перечитуємо
 * з бази весь сайт, а правимо цей товар прямо в уже завантажених списках. Списки товарів позначаємо застарілими:
 * перечитаються самі, коли їх відкриють наступного разу (і тоді, напр., прихований зникне з вітрини покупця).
 */
function patchProduct(queryClient: QueryClient, id: string, patch: Partial<Product> | null) {
  const apply = (p: Product) => (patch ? { ...p, ...patch } : null)
  queryClient.setQueriesData({ predicate: (q) => isProductQuery(q.queryKey) }, (data: unknown) => {
    if (Array.isArray(data)) {
      if (!data.some((p: Product) => p?.id === id)) return data
      return data.flatMap((p: Product) => (p?.id === id ? (apply(p) ?? []) : [p]))
    }
    if (data && typeof data === 'object' && (data as Product).id === id) return apply(data as Product)
    return data
  })
  return queryClient.invalidateQueries({ predicate: (q) => isProductQuery(q.queryKey), refetchType: 'none' })
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
    // Перечитуємо товари одразу — і ті сторінки, що зараз закриті (каталог, пошук, сторінка товару):
    // форма чекає на це, тож після «Зберегти» й «Назад» ніде не мигне старий стан (напр., без нового фото).
    // Решту кешу (замовлення, аналітика…) просто позначаємо застарілим.
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ predicate: (q) => isProductQuery(q.queryKey), refetchType: 'all' }),
        queryClient.invalidateQueries(),
      ]),
  })
}

/** Залишок на складі — швидко з картки (кнопки − / +), без форми редагування. */
export function useSetStock() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, stock }: { id: string; stock: number }) => updateDoc(doc(db, 'products', id), { stock: Math.max(0, stock), updatedAt: serverTimestamp() }),
    onSuccess: (_, { id, stock }) => patchProduct(queryClient, id, { stock: Math.max(0, stock) }),
  })
}

/** Показати / приховати товар. Залишок на складі не змінюється — лише видимість для покупців. */
export function useToggleProductActive() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      updateDoc(doc(db, 'products', id), { isActive, updatedAt: serverTimestamp() }),
    onSuccess: (_, { id, isActive }) => patchProduct(queryClient, id, { isActive }),
  })
}

/** Позначити «на головну» / зняти позначку (шпилька на картці продавця). */
export function useToggleOnHome() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, onHome }: { id: string; onHome: boolean }) =>
      updateDoc(doc(db, 'products', id), {
        onHome,
        onHomeAt: onHome ? serverTimestamp() : deleteField(),
        updatedAt: serverTimestamp(),
      }),
    // Список позначених на головній перечитуємо одразу (він маленький) — щоб щойно позначена рослина стала першою
    onSuccess: async (_, { id, onHome }) => {
      await patchProduct(queryClient, id, { onHome })
      await queryClient.refetchQueries({ queryKey: ['products', 'home'] })
    },
  })
}

/** У продаж / зняти з продажу. Залишок не змінюється — покупці просто бачать 0, поки рослина не на продаж. */
export function useToggleForSale() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, forSale }: { id: string; forSale: boolean }) =>
      updateDoc(doc(db, 'products', id), { forSale, updatedAt: serverTimestamp() }),
    onSuccess: (_, { id, forSale }) => patchProduct(queryClient, id, { forSale }),
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
    onSuccess: (_, id) => patchProduct(queryClient, id, null),
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
