import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { onDocumentWritten } from 'firebase-functions/firestore'
import { runTrigger } from './observability.js'

/**
 * Лічильник «скільки людей додали рослину в улюблене» (поле likes у товарі).
 * Улюблене покупця зберігається в users/{uid}.favorites (список id товарів); покупець сам товари змінювати не може,
 * тож лічильник рахує сервер: порівнює список до й після зміни і додає +1 / −1 відповідним товарам.
 *
 * Тригер може спрацювати двічі на ту саму подію — тому кожну подію позначаємо в _processedEvents
 * і в тій самій транзакції перевіряємо, чи її вже не враховано (інакше лайки задвоїлись би).
 * Гості (без входу) зберігають улюблене лише в браузері — вони в лічильник не потрапляють.
 */
export const onFavoritesChanged = onDocumentWritten('users/{uid}', async (event) => {
  const before = new Set<string>((event.data?.before.data()?.favorites as string[] | undefined) ?? [])
  const after = new Set<string>((event.data?.after.data()?.favorites as string[] | undefined) ?? [])
  const added = [...after].filter((id) => !before.has(id))
  const removed = [...before].filter((id) => !after.has(id))
  if (added.length === 0 && removed.length === 0) return

  const db = getFirestore()
  const marker = db.collection('_processedEvents').doc(`favorites-${event.id}`)
  await runTrigger('onFavoritesChanged', { uid: event.params.uid, added: added.length, removed: removed.length }, () =>
    db.runTransaction(async (tx) => {
      if ((await tx.get(marker)).exists) return
      const changes = [...added.map((id) => [id, 1] as const), ...removed.map((id) => [id, -1] as const)]
      // Товар могли вже видалити — такі пропускаємо (update на неіснуючий документ зламав би всю транзакцію)
      const snaps = changes.length ? await tx.getAll(...changes.map(([id]) => db.collection('products').doc(id))) : []
      snaps.forEach((snap, i) => {
        if (snap.exists) tx.update(snap.ref, { likes: FieldValue.increment(changes[i][1]) })
      })
      tx.create(marker, { at: FieldValue.serverTimestamp() })
    }),
  )
})
