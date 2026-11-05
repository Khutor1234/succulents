import { z } from 'zod'
import { isLviv } from '../../lib/shop'

// Ті самі правила перевіряє Cloud Function createOrder (functions/src/schema.ts).
// Повідомлення — ключі перекладів i18n.
/** Поля форми без перевірок «між полями» (з них бере поля й кабінет — дані доставки). */
export const checkoutFields = z.object({
  fullName: z.string().trim().min(2, 'errors.required').max(100),
  phone: z
    .string()
    .transform((v) => v.replace(/[\s()-]/g, ''))
    .pipe(z.string().regex(/^(\+?38)?0\d{9}$/, 'errors.phone')),
  email: z.email('errors.email'),
  city: z.string().trim().min(2, 'errors.required').max(100),
  // Обов'язкове лише для Нової Пошти (див. перевірку нижче)
  warehouse: z.string().trim().max(200).default(''),
  /** Доставка таксі по Львову замість Нової Пошти — тоді потрібна адреса, а відділення ні. */
  taxi: z.boolean().default(false),
  address: z.string().trim().max(300).default(''),
  comment: z.string().trim().max(1000).optional(),
  // Оплата лише передоплатою на картку перед відправкою.
  paymentMethod: z.literal('card_transfer'),
})

export const checkoutSchema = checkoutFields.superRefine((v, ctx) => {
  if (v.taxi && isLviv(v.city)) {
    if (v.address.length < 5) ctx.addIssue({ code: 'custom', path: ['address'], message: 'errors.address' })
  } else if (!v.warehouse) {
    ctx.addIssue({ code: 'custom', path: ['warehouse'], message: 'errors.required' })
  }
})

export type CheckoutInput = z.input<typeof checkoutSchema>
export type CheckoutData = z.output<typeof checkoutSchema>
