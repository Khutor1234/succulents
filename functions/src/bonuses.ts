import { FieldValue, type DocumentReference, type Firestore, type Transaction } from 'firebase-admin/firestore'

/** 10% від сплаченої суми повертається бонусами. */
export const BONUS_RATE = 0.1

/** Вітальний бонус за реєстрацію / перший вхід: 100 грн (у копійках). */
export const WELCOME_BONUS = 100_00

export function bonusFor(paidKopecks: number): number {
  return Math.floor(paidKopecks * BONUS_RATE)
}

export type BonusEntryType = 'spend' | 'earn' | 'refund' | 'revoke' | 'welcome'

export const bonusAccountRef = (db: Firestore, uid: string) => db.collection('bonuses').doc(uid)

/**
 * Змінює баланс і пише рядок в історію в межах транзакції.
 * `delta` у копійках: додатне — нарахування, від'ємне — списання.
 */
export function applyBonus(
  tx: Transaction,
  db: Firestore,
  uid: string,
  delta: number,
  entry: { type: BonusEntryType; orderId: string; orderNumber: string },
  /** Додаткові поля рахунку, що записуються тим самим set (напр. welcomeGranted). */
  accountFields: Record<string, unknown> = {},
) {
  const account: DocumentReference = bonusAccountRef(db, uid)
  tx.set(
    account,
    { ...accountFields, balance: FieldValue.increment(delta), updatedAt: FieldValue.serverTimestamp() },
    { merge: true },
  )
  tx.create(account.collection('history').doc(), {
    ...entry,
    amount: delta,
    createdAt: FieldValue.serverTimestamp(),
  })
}
