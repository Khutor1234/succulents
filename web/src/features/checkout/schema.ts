import { z } from 'zod'

// Ті самі правила перевіряє Cloud Function createOrder (functions/src/schema.ts).
// Повідомлення — ключі перекладів i18n.
export const checkoutSchema = z.object({
  fullName: z.string().trim().min(2, 'errors.required').max(100),
  phone: z
    .string()
    .transform((v) => v.replace(/[\s()-]/g, ''))
    .pipe(z.string().regex(/^(\+?38)?0\d{9}$/, 'errors.phone')),
  email: z.email('errors.email'),
  city: z.string().trim().min(2, 'errors.required').max(100),
  warehouse: z.string().trim().min(1, 'errors.required').max(200),
  comment: z.string().trim().max(1000).optional(),
  // Оплата лише передоплатою на картку перед відправкою.
  paymentMethod: z.literal('card_transfer'),
})

export type CheckoutInput = z.input<typeof checkoutSchema>
export type CheckoutData = z.output<typeof checkoutSchema>
