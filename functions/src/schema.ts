import { z } from 'zod'

// Ті самі правила, що й у формі на сайті (web/src/features/checkout/schema.ts).
// Сервер перевіряє все ще раз: даним з браузера довіряти не можна.
export const customerSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  phone: z
    .string()
    .transform((v) => v.replace(/[\s()-]/g, ''))
    .pipe(z.string().regex(/^(\+?38)?0\d{9}$/)),
  email: z.email(),
  city: z.string().trim().min(2).max(100),
  warehouse: z.string().trim().min(1).max(200),
  comment: z.string().trim().max(1000).optional(),
  // Нові замовлення — лише передоплата на картку. 'cod' лишається в типі Order для старих замовлень.
  paymentMethod: z.literal('card_transfer'),
})

export const createOrderSchema = z.object({
  items: z
    .array(z.object({ productId: z.string().min(1).max(128), qty: z.int().min(1).max(99) }))
    .min(1)
    .max(50),
  customer: customerSchema,
  lang: z.enum(['uk', 'en']).default('uk'),
  /** Списати бонуси з рахунку (тільки для залогінених). */
  useBonuses: z.boolean().default(false),
})

export type CreateOrderInput = z.output<typeof createOrderSchema>

export interface Localized {
  uk: string
  en: string
}

export interface OrderItem {
  productId: string
  name: Localized
  price: number
  /** Скільки штук буде відправлено (після змін продавця може бути менше за замовлене, навіть 0). */
  qty: number
  /** Скільки покупець замовив спочатку. З'являється, коли продавець змінює склад замовлення. */
  originalQty?: number
  /** Головне фото товару на момент замовлення. */
  image?: string
  /** Ціна на момент замовлення — є, якщо продавець потім змінив ціну позиції. */
  originalPrice?: number
  /** Позицію додав продавець після оформлення (покупець її не замовляв). */
  added?: boolean
}

export const adjustOrderSchema = z.object({
  orderId: z.string().min(1).max(128),
  items: z
    .array(
      z.object({
        productId: z.string().min(1).max(128),
        qty: z.int().min(0).max(99),
        /** Нова ціна за штуку, копійки. Не передали — лишається як була (або з каталогу для нової позиції). */
        price: z.int().min(0).max(100_000_000).optional(),
      }),
    )
    .min(1)
    .max(50),
  /** Знижка (−) чи доплата (+) до суми, копійки: напр. −5000 «знижка за пошкоджений листок». */
  adjustment: z.int().min(-100_000_000).max(100_000_000).optional(),
  adjustmentNote: z.string().trim().max(200).optional(),
})

export interface Order {
  number: string
  userId: string | null
  email: string
  accessToken: string
  items: OrderItem[]
  /** Сума товарів до знижки, копійки. */
  subtotal: number
  /** Скільки бонусів списано. Бонуси, як і ціни, у копійках: 1 бонусна гривня = 1 грн знижки. */
  bonusUsed: number
  /** Знижка (−) чи доплата (+) від продавця, копійки. */
  adjustment?: number
  adjustmentNote?: string
  /** До сплати: subtotal + adjustment − bonusUsed. */
  total: number
  /** Скільки бонусів нарахується, коли замовлення стане «Виконане». 0 для гостей. */
  bonusEarned: number
  // Службові позначки тригера onOrderStatusChanged — щоб кожна дія виконалась рівно один раз.
  bonusCredited?: boolean
  bonusRefunded?: boolean
  stockRestored?: boolean
  status: 'new' | 'confirmed' | 'shipped' | 'done' | 'cancelled'
  delivery: { fullName: string; phone: string; city: string; warehouse: string; comment: string }
  payment: { method: 'cod' | 'card_transfer'; paid: boolean }
  lang: 'uk' | 'en'
}
