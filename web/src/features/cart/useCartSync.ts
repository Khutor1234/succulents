import { doc, getDoc } from 'firebase/firestore'
import { useCallback, useEffect, useRef } from 'react'
import { create } from 'zustand'
import { db } from '../../firebase/config'
import type { Product } from '../../lib/types'
import { forBuyer } from '../catalog/api'
import { useCategories } from '../catalog/categories'
import { useCart } from './cartStore'

/** Що змінилось у кошику після звірки з магазином — щоб пояснити покупцю. */
export type CartChange =
  | { kind: 'price'; name: string; from: number; to: number }
  | { kind: 'less'; name: string; left: number }
  | { kind: 'gone'; name: string }

/**
 * Останні зміни — окремо від компонентів: сторінка оформлення може повернути людину в кошик,
 * і повідомлення має там лишитися. Нові зміни замінюють старі; «зрозуміло» — прибирає.
 */
export const useCartChanges = create<{ changes: CartChange[]; dismiss: () => void }>((set) => ({
  changes: [],
  dismiss: () => set({ changes: [] }),
}))

/**
 * Кошик зберігається в браузері й може застаріти: товар розкупили, приховали чи змінили ціну.
 * Звіряємо кошик із базою при відкритті кошика й оформлення і поправляємо його:
 * нова ціна, кількість не більша за залишок, недоступні товари — прибираємо.
 * Зміни кладе в useCartChanges (показує CartChanges); повертає функцію, щоб звірити ще раз (напр. після відмови сервера).
 */
export function useCartSync() {
  const { visible, isLoading: categoriesLoading } = useCategories()
  // Список видимих категорій — рядком: функції з useCategories створюються наново щоразу,
  // і залежність від них запускала б звірку після кожного оновлення кошика (нескінченний цикл).
  const visibleKey = visible.join(',')
  const synced = useRef(false)

  const sync = useCallback(async () => {
    const asked = useCart.getState().items
    if (asked.length === 0) return []
    const fetched = await Promise.all(
      asked.map(async (item) => {
        try {
          const snap = await getDoc(doc(db, 'products', item.productId))
          // Залишок — той, що доступний покупцю (без рослин «не на продаж» і без останньої рослини)
          return snap.exists() ? forBuyer(snap.data() as Product) : null
        } catch {
          return null // прихований товар покупцю не видно — так само «недоступний»
        }
      }),
    )
    const fresh = new Map(asked.map((item, i) => [item.productId, fetched[i]]))
    // Поки чекали на базу, покупець міг змінити кількість чи додати товар — тож беремо кошик, який є зараз,
    // а не той, що був на початку звірки. Товари, додані під час звірки, лишаємо як є
    const items = useCart.getState().items
    const found: CartChange[] = []
    const next = items.flatMap((item) => {
      if (!fresh.has(item.productId)) return [item]
      const p = fresh.get(item.productId)
      const name = item.name.uk
      if (!p || !p.isActive || !visibleKey.split(',').includes(p.category) || p.stock <= 0) {
        found.push({ kind: 'gone', name })
        return []
      }
      const updated = { ...item, price: p.price, maxQty: p.stock, name: p.name, image: p.images?.[0] ?? item.image, cutting: p.tags?.includes('cutting') ?? false }
      if (p.price !== item.price) found.push({ kind: 'price', name, from: item.price, to: p.price })
      if (item.qty > p.stock) {
        found.push({ kind: 'less', name, left: p.stock })
        updated.qty = p.stock
      }
      return [updated]
    })
    useCart.setState({ items: next })
    if (found.length) useCartChanges.setState({ changes: found })
    return found
  }, [visibleKey])

  useEffect(() => {
    // Чекаємо налаштування категорій — інакше товари зі схованих категорій не розпізнаємо.
    // Один раз на відкриття сторінки (після того, як завантажились категорії).
    if (categoriesLoading || synced.current) return
    synced.current = true
    void sync()
  }, [categoriesLoading, sync])

  return { sync }
}
