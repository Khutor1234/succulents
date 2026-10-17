import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Localized } from '../../lib/types'

export interface CartItem {
  productId: string
  slug: string
  name: Localized
  /** Ціна лише для показу; сервер при оформленні бере ціну з бази. */
  price: number
  image?: string
  qty: number
  maxQty: number
}

interface CartState {
  items: CartItem[]
  add: (item: Omit<CartItem, 'qty'>, qty?: number) => void
  setQty: (productId: string, qty: number) => void
  remove: (productId: string) => void
  clear: () => void
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      add: (item, qty = 1) =>
        set((s) => {
          const existing = s.items.find((i) => i.productId === item.productId)
          if (existing) {
            return {
              items: s.items.map((i) =>
                i.productId === item.productId ? { ...i, ...item, qty: Math.min(i.qty + qty, item.maxQty) } : i,
              ),
            }
          }
          return { items: [...s.items, { ...item, qty: Math.min(qty, item.maxQty) }] }
        }),
      setQty: (productId, qty) =>
        set((s) => ({
          items: s.items.map((i) => (i.productId === productId ? { ...i, qty: Math.max(1, Math.min(qty, i.maxQty)) } : i)),
        })),
      remove: (productId) => set((s) => ({ items: s.items.filter((i) => i.productId !== productId) })),
      clear: () => set({ items: [] }),
    }),
    { name: 'cart' },
  ),
)

export const selectCount = (s: CartState) => s.items.reduce((sum, i) => sum + i.qty, 0)
export const selectTotal = (s: CartState) => s.items.reduce((sum, i) => sum + i.qty * i.price, 0)
