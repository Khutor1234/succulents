import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { addDoc, arrayRemove, arrayUnion, collection, deleteDoc, doc, getDocs, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useAuth } from '../auth/authStore'

/**
 * Робочі списки продавця («Перевірити кількість», «Пересадити»…): у список додають рослини кнопкою на картці,
 * а в «Товари → Списки» видно, що з чим зробити, і можна відмічати зроблене. Покупці їх не бачать (лише продавець у Rules).
 * sellerLists/{id}: name, items — id товарів у порядку додавання, done — id уже зроблених.
 */
export interface SellerList {
  id: string
  name: string
  items: string[]
  done: string[]
  createdAt: number
}

const KEY = ['admin', 'sellerLists']

export function useSellerLists() {
  const isSeller = useAuth((s) => s.role === 'seller')
  return useQuery({
    queryKey: KEY,
    enabled: isSeller,
    queryFn: async () =>
      (await getDocs(collection(db, 'sellerLists'))).docs
        .map((d) => {
          const x = d.data()
          return {
            id: d.id,
            name: String(x.name ?? ''),
            items: (x.items ?? []) as string[],
            done: (x.done ?? []) as string[],
            createdAt: x.createdAt?.toMillis?.() ?? Date.now(),
          }
        })
        .sort((a, b) => a.createdAt - b.createdAt),
  })
}

/** Правимо списки прямо в кеші — кнопки відгукуються одразу, без перечитування. */
function useEditLists() {
  const qc = useQueryClient()
  return (fn: (lists: SellerList[]) => SellerList[]) => qc.setQueryData<SellerList[]>(KEY, (old = []) => fn(old))
}

/** Новий список; `productId` — одразу додати в нього цю рослину. */
export function useCreateList() {
  const edit = useEditLists()
  return useMutation({
    mutationFn: async ({ name, productId }: { name: string; productId?: string }) => {
      const items = productId ? [productId] : []
      const ref = await addDoc(collection(db, 'sellerLists'), { name: name.trim(), items, done: [], createdAt: serverTimestamp() })
      return { id: ref.id, name: name.trim(), items, done: [], createdAt: Date.now() } satisfies SellerList
    },
    onSuccess: (list) => edit((old) => [...old, list]),
  })
}

/** Додати рослину в список / прибрати з нього (разом із позначкою «зроблено»). */
export function useToggleInList() {
  const edit = useEditLists()
  return useMutation({
    mutationFn: ({ listId, productId, on }: { listId: string; productId: string; on: boolean }) =>
      updateDoc(doc(db, 'sellerLists', listId), on ? { items: arrayUnion(productId) } : { items: arrayRemove(productId), done: arrayRemove(productId) }),
    onMutate: ({ listId, productId, on }) =>
      edit((old) =>
        old.map((l) =>
          l.id !== listId
            ? l
            : on
              ? { ...l, items: l.items.includes(productId) ? l.items : [...l.items, productId] }
              : { ...l, items: l.items.filter((x) => x !== productId), done: l.done.filter((x) => x !== productId) },
        ),
      ),
  })
}

/** Відмітити рослину в списку як зроблену (або зняти позначку). */
export function useToggleDone() {
  const edit = useEditLists()
  return useMutation({
    mutationFn: ({ listId, productId, done }: { listId: string; productId: string; done: boolean }) =>
      updateDoc(doc(db, 'sellerLists', listId), { done: done ? arrayUnion(productId) : arrayRemove(productId) }),
    onMutate: ({ listId, productId, done }) =>
      edit((old) => old.map((l) => (l.id !== listId ? l : { ...l, done: done ? [...new Set([...l.done, productId])] : l.done.filter((x) => x !== productId) }))),
  })
}

/** Прибрати зі списку всі зроблені рослини. */
export function useClearDone() {
  const edit = useEditLists()
  return useMutation({
    mutationFn: (list: SellerList) => updateDoc(doc(db, 'sellerLists', list.id), { items: list.items.filter((x) => !list.done.includes(x)), done: [] }),
    onMutate: (list) => edit((old) => old.map((l) => (l.id !== list.id ? l : { ...l, items: l.items.filter((x) => !l.done.includes(x)), done: [] }))),
  })
}

export function useRenameList() {
  const edit = useEditLists()
  return useMutation({
    mutationFn: ({ listId, name }: { listId: string; name: string }) => updateDoc(doc(db, 'sellerLists', listId), { name: name.trim() }),
    onMutate: ({ listId, name }) => edit((old) => old.map((l) => (l.id === listId ? { ...l, name: name.trim() } : l))),
  })
}

export function useDeleteList() {
  const edit = useEditLists()
  return useMutation({
    mutationFn: (listId: string) => deleteDoc(doc(db, 'sellerLists', listId)),
    onMutate: (listId) => edit((old) => old.filter((l) => l.id !== listId)),
  })
}
