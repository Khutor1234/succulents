import { create } from 'zustand'
import type { Localized } from '../../lib/types'

export interface CartToast {
  /** Унікальний на кожне показування — щоб анімація перезапускалась, навіть якщо додали той самий товар. */
  key: number
  productId: string
  name: Localized
  image?: string
}

interface ToastState {
  toast: CartToast | null
  show: (t: Omit<CartToast, 'key'>) => void
  hide: () => void
}

let timer: ReturnType<typeof setTimeout> | undefined

export const useCartToast = create<ToastState>((set) => ({
  toast: null,
  show: (t) => {
    clearTimeout(timer)
    set({ toast: { ...t, key: Date.now() } })
    timer = setTimeout(() => set({ toast: null }), 3000)
  },
  hide: () => {
    clearTimeout(timer)
    set({ toast: null })
  },
}))
