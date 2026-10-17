import { useQuery } from '@tanstack/react-query'
import { collection, doc, getDoc, getDocs, limit, orderBy, query, where, type Timestamp } from 'firebase/firestore'
import { db } from '../../firebase/config'
import type { Order } from '../../lib/types'
import { useAuth } from '../auth/authStore'

/** Має збігатися з BONUS_RATE у functions/src/bonuses.ts — тут лише для підказок покупцю. */
export const BONUS_RATE = 0.1

export interface BonusEntry {
  id: string
  type: 'spend' | 'earn' | 'refund' | 'revoke' | 'welcome'
  amount: number
  orderNumber: string
  createdAt?: Timestamp
}

/** Баланс бонусів залогіненого покупця (у копійках). Для гостя — 0. */
export function useBonusBalance() {
  const uid = useAuth((s) => s.user?.uid)
  const q = useQuery({
    queryKey: ['bonuses', uid],
    enabled: !!uid,
    staleTime: 0,
    queryFn: async () => {
      const snap = await getDoc(doc(db, 'bonuses', uid!))
      return Math.max(0, (snap.data()?.balance as number | undefined) ?? 0)
    },
  })
  return { balance: uid ? (q.data ?? 0) : 0, isLoading: q.isLoading }
}

export function useBonusHistory() {
  const uid = useAuth((s) => s.user?.uid)
  return useQuery({
    queryKey: ['bonuses', uid, 'history'],
    enabled: !!uid,
    staleTime: 0,
    queryFn: async () => {
      const snap = await getDocs(query(collection(db, 'bonuses', uid!, 'history'), orderBy('createdAt', 'desc'), limit(50)))
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as BonusEntry)
    },
  })
}

export function useMyOrders() {
  const uid = useAuth((s) => s.user?.uid)
  return useQuery({
    queryKey: ['orders', 'mine', uid],
    enabled: !!uid,
    staleTime: 0,
    queryFn: async () => {
      const snap = await getDocs(
        query(collection(db, 'orders'), where('userId', '==', uid), orderBy('createdAt', 'desc'), limit(50)),
      )
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Order)
    },
  })
}
