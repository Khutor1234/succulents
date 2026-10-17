import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'
import { HttpsError, onCall } from 'firebase-functions/https'
import { applyBonus, bonusFor } from './bonuses.js'
import { withLogging } from './observability.js'
import { adjustOrderSchema, type Localized, type Order, type OrderItem } from './schema.js'

/** Статуси, у яких продавець ще може змінити склад замовлення. */
const EDITABLE: Order['status'][] = ['new', 'confirmed', 'shipped']

interface ProductDoc {
  name: Localized
  price: number
  stock: number
  images?: string[]
}

/**
 * Продавець редагує прийняте замовлення: міняє кількість (і більше, і менше), ціну позиції,
 * прибирає позиції, додає нові товари з каталогу та ставить знижку чи доплату до суми.
 *
 * Що відбувається в одній транзакції:
 * - різниця кількості повертається на склад або списується з нього (якщо товару не вистачає — помилка);
 * - перераховуються сума, «до сплати» і майбутні бонуси (10% від нової суми);
 * - якщо покупець списав бонусів більше, ніж тепер коштує замовлення, — надлишок повертається йому на рахунок.
 */
export const adjustOrder = onCall(withLogging('adjustOrder', async (request) => {
  if (request.auth?.token.role !== 'seller') throw new HttpsError('permission-denied', 'Sellers only')

  const parsed = adjustOrderSchema.safeParse(request.data)
  if (!parsed.success) throw new HttpsError('invalid-argument', 'Invalid data', parsed.error.issues)
  const requested = new Map(parsed.data.items.map((i) => [i.productId, i]))

  const db = getFirestore()
  const orderRef = db.collection('orders').doc(parsed.data.orderId)

  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(orderRef)
    const order = snap.data() as Order | undefined
    if (!order) throw new HttpsError('not-found', 'Order not found')
    if (!EDITABLE.includes(order.status)) {
      throw new HttpsError('failed-precondition', `Order in status "${order.status}" cannot be changed`)
    }

    const existingIds = new Set(order.items.map((i) => i.productId))
    const newIds = [...requested.values()].filter((r) => !existingIds.has(r.productId) && r.qty > 0).map((r) => r.productId)
    const ids = [...existingIds, ...newIds]
    const productSnaps = await tx.getAll(...ids.map((id) => db.collection('products').doc(id)))
    const productById = new Map(productSnaps.map((s) => [s.id, s]))

    // Позиції, що вже були в замовленні.
    const kept: OrderItem[] = []
    const before = new Map<string, number>()
    for (const item of order.items) {
      before.set(item.productId, item.qty)
      const req = requested.get(item.productId)
      const qty = req?.qty ?? item.qty
      // Доданий продавцем товар, який потім прибрали, просто зникає зі списку.
      if (item.added && qty === 0) continue
      const price = req?.price ?? item.price
      // Ціна з моменту замовлення — щоб покупець бачив, що її змінили (повернули стару — позначка зникає).
      const { originalPrice: firstPrice = item.price, ...rest } = item
      kept.push({
        ...rest,
        qty,
        price,
        originalQty: item.originalQty ?? item.qty,
        ...(firstPrice !== price ? { originalPrice: firstPrice } : {}),
      })
    }

    // Нові позиції з каталогу.
    for (const id of newIds) {
      const product = productById.get(id)?.data() as ProductDoc | undefined
      if (!product) throw new HttpsError('not-found', `Product ${id} not found`, { productId: id })
      const req = requested.get(id)!
      const image = product.images?.[0]
      kept.push({
        productId: id,
        name: product.name,
        price: req.price ?? product.price,
        qty: req.qty,
        originalQty: 0,
        added: true,
        ...(image ? { image } : {}),
      })
    }

    if (kept.every((i) => i.qty === 0)) {
      throw new HttpsError('failed-precondition', 'Nothing left in the order — cancel it instead')
    }

    // Склад: повертаємо або списуємо різницю з попереднім станом.
    const stockChanges: [FirebaseFirestore.DocumentReference, number][] = []
    for (const item of kept) {
      const diff = (before.get(item.productId) ?? 0) - item.qty // > 0 — товар повертається на склад
      if (diff === 0) continue
      const productSnap = productById.get(item.productId)
      if (!productSnap?.exists) continue
      const stock = (productSnap.data()?.stock as number | undefined) ?? 0
      if (diff < 0 && stock < -diff) {
        throw new HttpsError('failed-precondition', `Not enough stock for ${item.productId}`, {
          reason: 'stock',
          productId: item.productId,
          available: stock,
        })
      }
      stockChanges.push([productSnap.ref, diff])
    }
    // Прибрані додані позиції теж повертаються на склад.
    for (const item of order.items) {
      if (item.added && !kept.some((k) => k.productId === item.productId) && item.qty > 0) {
        const productSnap = productById.get(item.productId)
        if (productSnap?.exists) stockChanges.push([productSnap.ref, item.qty])
      }
    }
    for (const [ref, diff] of stockChanges) tx.update(ref, { stock: FieldValue.increment(diff) })

    const subtotal = kept.reduce((sum, i) => sum + i.price * i.qty, 0)
    const adjustment = parsed.data.adjustment ?? order.adjustment ?? 0
    const adjustmentNote = parsed.data.adjustmentNote ?? order.adjustmentNote ?? ''
    const gross = subtotal + adjustment
    if (gross < 0) throw new HttpsError('invalid-argument', 'Discount is larger than the order', { reason: 'negative' })

    const bonusUsedBefore = order.bonusUsed ?? 0
    const bonusUsed = Math.min(bonusUsedBefore, gross)
    const entry = { orderId: orderRef.id, orderNumber: order.number }
    if (order.userId && bonusUsed < bonusUsedBefore) {
      applyBonus(tx, db, order.userId, bonusUsedBefore - bonusUsed, { type: 'refund', ...entry })
    }
    const total = gross - bonusUsed

    tx.update(orderRef, {
      items: kept,
      subtotal,
      // Нульову знижку не зберігаємо, щоб у замовленні не висів порожній рядок.
      adjustment: adjustment ? adjustment : FieldValue.delete(),
      adjustmentNote: adjustment && adjustmentNote ? adjustmentNote : FieldValue.delete(),
      bonusUsed,
      total,
      bonusEarned: order.userId ? bonusFor(total) : 0,
      adjustedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
    return { subtotal, adjustment, total, bonusUsed }
  })

  logger.info('Order adjusted', { orderId: orderRef.id, by: request.auth.uid, items: parsed.data.items, ...result })
  return result
}))
