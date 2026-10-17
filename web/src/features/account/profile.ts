import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { z } from 'zod'
import { db } from '../../firebase/config'
import { useAuth } from '../auth/authStore'
import { checkoutSchema } from '../checkout/schema'

/** Дані доставки, які покупець зберігає в кабінеті й які підставляються в оформлення. */
export const deliveryProfileSchema = checkoutSchema.pick({ fullName: true, phone: true, city: true, warehouse: true })
export type DeliveryProfileInput = z.input<typeof deliveryProfileSchema>
export type DeliveryProfile = z.output<typeof deliveryProfileSchema>

const EMPTY: DeliveryProfile = { fullName: '', phone: '', city: '', warehouse: '' }

/** users/{uid}.delivery — читати й писати може лише сам покупець (див. firestore.rules). */
export function useDeliveryProfile() {
  const uid = useAuth((s) => s.user?.uid)
  return useQuery({
    queryKey: ['profile', uid],
    enabled: !!uid,
    queryFn: async () => {
      const snap = await getDoc(doc(db, 'users', uid!))
      return { ...EMPTY, ...(snap.data()?.delivery as Partial<DeliveryProfile> | undefined) }
    },
  })
}

export function useSaveDeliveryProfile() {
  const uid = useAuth((s) => s.user?.uid)
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (delivery: DeliveryProfile) =>
      setDoc(doc(db, 'users', uid!), { delivery, updatedAt: serverTimestamp() }, { merge: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profile', uid] }),
  })
}
