import { randomBytes } from 'node:crypto'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'
import { HttpsError, onCall } from 'firebase-functions/https'
import { applyBonus, bonusAccountRef, bonusFor } from './bonuses.js'
import { withLogging } from './observability.js'
import { createOrderSchema, type Localized, type Order, type OrderItem } from './schema.js'

/** Мінімальна сума замовлення за товари, копійки. Має збігатися з MIN_ORDER у web/src/lib/shop.ts. */
export const MIN_ORDER = 1000_00

interface ProductDoc {
  category: string
  name: Localized
  price: number
  stock: number
  isActive: boolean
  /** false — рослина не на продаж (покупці бачать «немає в наявності»). Не вказано — продається. */
  forSale?: boolean
  images?: string[]
}

/**
 * Створює замовлення. Працює і для гостей, і для залогінених.
 * Ціни й залишки беруться тільки з бази, а не з браузера.
 */
export const createOrder = onCall(withLogging('createOrder', async (request) => {
  const parsed = createOrderSchema.safeParse(request.data)
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', 'Invalid order data', parsed.error.issues)
  }
  const { customer, lang } = parsed.data
  const uid = request.auth?.uid ?? null
  // Гість бонусів не має, навіть якщо браузер надіслав useBonuses: true.
  const useBonuses = parsed.data.useBonuses && uid !== null

  // Якщо той самий товар прийшов кількома рядками — об'єднуємо.
  const qtyById = new Map<string, number>()
  for (const { productId, qty } of parsed.data.items) {
    qtyById.set(productId, (qtyById.get(productId) ?? 0) + qty)
  }

  const db = getFirestore()
  const orderRef = db.collection('orders').doc()
  const counterRef = db.collection('counters').doc('orders')

  const result = await db.runTransaction(async (tx) => {
    const productRefs = [...qtyById.keys()].map((id) => db.collection('products').doc(id))
    const settingsRef = db.collection('settings').doc('categories')
    const [counterSnap, settingsSnap, ...productSnaps] = await tx.getAll(counterRef, settingsRef, ...productRefs)
    // Баланс читаємо в тій самій транзакції — тоді два одночасні замовлення не спишуть ті самі бонуси двічі.
    const bonusSnap = useBonuses && uid ? await tx.get(bonusAccountRef(db, uid)) : null

    // Товари зі схованих в адмінці категорій замовити не можна.
    const hiddenCategories = new Set(
      ((settingsSnap.data()?.items ?? []) as { id: string; visible: boolean }[]).filter((c) => !c.visible).map((c) => c.id),
    )

    const items: OrderItem[] = productSnaps.map((snap) => {
      const product = snap.data() as ProductDoc | undefined
      const qty = qtyById.get(snap.id)!
      if (!product || !product.isActive || hiddenCategories.has(product.category)) {
        throw new HttpsError('not-found', `Product ${snap.id} is not available`, { productId: snap.id })
      }
      // Не на продаж — для покупця так само «недоступний», але в журналі видно окрему причину
      if (product.forSale === false) {
        throw new HttpsError('not-found', `Product ${snap.id} is not for sale`, { productId: snap.id })
      }
      if (product.stock < qty) {
        throw new HttpsError('failed-precondition', `Not enough stock for ${snap.id}`, {
          productId: snap.id,
          available: product.stock,
        })
      }
      const image = product.images?.[0]
      return { productId: snap.id, name: product.name, price: product.price, qty, ...(image ? { image } : {}) }
    })

    for (const item of items) {
      tx.update(db.collection('products').doc(item.productId), { stock: FieldValue.increment(-item.qty) })
    }

    const next = ((counterSnap.data()?.last as number | undefined) ?? 1000) + 1
    tx.set(counterRef, { last: next })
    const number = `SC-${next}`

    const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0)
    // Мінімальне замовлення — за товари, до знижки бонусами (сайт теж не пускає далі кошика).
    if (subtotal < MIN_ORDER) {
      throw new HttpsError('failed-precondition', 'Order is below the minimum amount', { reason: 'min-order', minOrder: MIN_ORDER, subtotal })
    }
    const balance = Math.max(0, (bonusSnap?.data()?.balance as number | undefined) ?? 0)
    const bonusUsed = Math.min(balance, subtotal)
    const total = subtotal - bonusUsed
    if (uid && bonusUsed > 0) {
      applyBonus(tx, db, uid, -bonusUsed, { type: 'spend', orderId: orderRef.id, orderNumber: number })
    }

    const order: Order = {
      number,
      userId: uid,
      // Залогіненому — завжди email акаунта (на сайті поле заблоковане); гість вводить свій.
      email: request.auth?.token.email ?? customer.email,
      accessToken: randomBytes(16).toString('hex'),
      items,
      subtotal,
      bonusUsed,
      total,
      // Нараховуємо з фактично сплаченої суми; самі бонуси зарахуються, коли замовлення стане «Виконане».
      bonusEarned: uid ? bonusFor(total) : 0,
      status: 'new',
      delivery: {
        fullName: customer.fullName,
        phone: customer.phone,
        city: customer.city,
        warehouse: customer.warehouse,
        comment: customer.comment ?? '',
      },
      payment: { method: customer.paymentMethod, paid: false },
      lang,
    }
    tx.create(orderRef, { ...order, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() })
    return { number, total, bonusUsed, bonusEarned: order.bonusEarned }
  })

  logger.info('Order created', { orderId: orderRef.id, uid, items: qtyById.size, ...result })
  return { orderId: orderRef.id, ...result }
}))
