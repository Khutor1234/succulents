import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/https'
import { withLogging } from './observability.js'
import type { Order } from './schema.js'

export interface CustomerRow {
  uid: string
  email: string | null
  displayName: string | null
  provider: 'google' | 'password' | 'other'
  emailVerified: boolean
  isSeller: boolean
  createdAt: string | null
  lastSignInAt: string | null
  /** Бонусний баланс, копійки. */
  balance: number
  ordersCount: number
  /** Сума виконаних замовлень (до сплати), копійки. */
  spent: number
  /** З кабінету покупця: збережені ПІБ і телефон. */
  fullName: string | null
  phone: string | null
}

/**
 * Список покупців для адмінки: акаунти з Firebase Auth + бонусний баланс, профіль і замовлення.
 * Список акаунтів є лише в Admin SDK, тому це серверна функція, доступна тільки продавцю.
 */
export const listCustomers = onCall(withLogging('listCustomers', async (request) => {
  if (request.auth?.token.role !== 'seller') throw new HttpsError('permission-denied', 'Sellers only')

  const auth = getAuth()
  const db = getFirestore()

  // Firebase Auth віддає акаунти сторінками по 1000.
  const users = []
  let pageToken: string | undefined
  do {
    const page = await auth.listUsers(1000, pageToken)
    users.push(...page.users)
    pageToken = page.pageToken
  } while (pageToken)

  const [bonusSnap, profileSnap, ordersSnap] = await Promise.all([
    db.collection('bonuses').get(),
    db.collection('users').get(),
    db.collection('orders').where('userId', '!=', null).get(),
  ])
  const balances = new Map(bonusSnap.docs.map((d) => [d.id, (d.data().balance as number | undefined) ?? 0]))
  const profiles = new Map(profileSnap.docs.map((d) => [d.id, d.data().delivery as { fullName?: string; phone?: string } | undefined]))
  const orderStats = new Map<string, { count: number; spent: number }>()
  for (const doc of ordersSnap.docs) {
    const o = doc.data() as Order
    if (!o.userId) continue
    const s = orderStats.get(o.userId) ?? { count: 0, spent: 0 }
    s.count++
    if (o.status === 'done') s.spent += o.total
    orderStats.set(o.userId, s)
  }

  const rows: CustomerRow[] = users.map((u) => {
    const providers = u.providerData.map((p) => p.providerId)
    return {
      uid: u.uid,
      email: u.email ?? null,
      displayName: u.displayName ?? null,
      provider: providers.includes('google.com') ? 'google' : providers.includes('password') ? 'password' : 'other',
      emailVerified: u.emailVerified,
      isSeller: u.customClaims?.role === 'seller',
      createdAt: u.metadata.creationTime ? new Date(u.metadata.creationTime).toISOString() : null,
      lastSignInAt: u.metadata.lastSignInTime ? new Date(u.metadata.lastSignInTime).toISOString() : null,
      balance: balances.get(u.uid) ?? 0,
      ordersCount: orderStats.get(u.uid)?.count ?? 0,
      spent: orderStats.get(u.uid)?.spent ?? 0,
      fullName: profiles.get(u.uid)?.fullName || null,
      phone: profiles.get(u.uid)?.phone || null,
    }
  })
  return { customers: rows }
}, (r) => ({ count: r.customers.length })))
