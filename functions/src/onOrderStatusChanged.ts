import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'
import { onDocumentUpdated } from 'firebase-functions/firestore'
import { applyBonus } from './bonuses.js'
import { runTrigger } from './observability.js'
import type { Order } from './schema.js'

/**
 * Реагує на зміну статусу замовлення:
 * - «Виконане» → нараховуємо покупцю 10% бонусами; якщо статус потім змінили назад — забираємо їх;
 * - «Скасоване» → повертаємо товари на склад і списані бонуси на рахунок.
 *
 * Кожна дія позначається прапорцем у замовленні (bonusCredited, bonusRefunded, stockRestored)
 * і перевіряється в транзакції — тож навіть якщо тригер спрацює двічі, нічого не задвоїться.
 */
export const onOrderStatusChanged = onDocumentUpdated('orders/{orderId}', async (event) => {
  const before = event.data?.before.data() as Order | undefined
  const after = event.data?.after.data() as Order | undefined
  if (!before || !after || before.status === after.status) return

  const db = getFirestore()
  const orderRef = db.collection('orders').doc(event.params.orderId)
  const logCtx = { orderId: orderRef.id, number: after.number, uid: after.userId, from: before.status, to: after.status }

  await runTrigger('onOrderStatusChanged', logCtx, () => db.runTransaction(async (tx) => {
    const order = (await tx.get(orderRef)).data() as Order | undefined
    if (!order) return
    const entry = { orderId: orderRef.id, orderNumber: order.number }
    const flags: Partial<Order> = {}

    // Читання мають іти до записів — тому спершу дізнаємось, які товари ще існують.
    const restoreStock = order.status === 'cancelled' && !order.stockRestored
    const productSnaps = restoreStock
      ? await tx.getAll(...order.items.map((i) => db.collection('products').doc(i.productId)))
      : []

    if (order.userId) {
      const shouldBeCredited = order.status === 'done'
      if (shouldBeCredited && !order.bonusCredited && order.bonusEarned > 0) {
        applyBonus(tx, db, order.userId, order.bonusEarned, { type: 'earn', ...entry })
        flags.bonusCredited = true
      } else if (!shouldBeCredited && order.bonusCredited) {
        applyBonus(tx, db, order.userId, -order.bonusEarned, { type: 'revoke', ...entry })
        flags.bonusCredited = false
      }

      if (order.status === 'cancelled' && !order.bonusRefunded && (order.bonusUsed ?? 0) > 0) {
        applyBonus(tx, db, order.userId, order.bonusUsed, { type: 'refund', ...entry })
        flags.bonusRefunded = true
      }
    }

    if (restoreStock) {
      order.items.forEach((item, i) => {
        // Товар могли вже видалити з бази — тоді повертати нікуди.
        if (productSnaps[i].exists) tx.update(productSnaps[i].ref, { stock: FieldValue.increment(item.qty) })
      })
      flags.stockRestored = true
    }

    if (Object.keys(flags).length > 0) tx.update(orderRef, flags)
    // Що саме зробив тригер (нарахував/зняв бонуси, повернув товари) — видно в журналі.
    logger.info('Order status side effects', { ...logCtx, ...flags })
  }))
})
