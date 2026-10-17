import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'
import { HttpsError, onCall } from 'firebase-functions/https'
import { defineString } from 'firebase-functions/params'
import { applyBonus, bonusAccountRef, WELCOME_BONUS } from './bonuses.js'
import { withLogging } from './observability.js'

// Email-и продавців через кому. Задаються у functions/.env (SELLER_EMAILS=a@gmail.com,b@gmail.com)
// і деплояться разом із функціями — без сервісних ключів і ручних скриптів.
const sellerEmails = defineString('SELLER_EMAILS', { default: '' })

/**
 * Викликається сайтом після кожного входу:
 * 1. Роль продавця: видає, якщо підтверджений email є в SELLER_EMAILS, і забирає, якщо його звідти прибрали.
 * 2. Вітальний бонус: 100 грн один раз на акаунт — за реєстрацію або перший вхід.
 *
 * Обидві дії вимагають підтвердженого email (Google-акаунти підтверджені завжди), щоб не можна було
 * наробити акаунтів на вигадані адреси й зібрати бонуси.
 */
export const syncAccount = onCall(withLogging('syncAccount', async (request) => {
  const token = request.auth?.token
  if (!request.auth || !token) throw new HttpsError('unauthenticated', 'Sign in first')
  const uid = request.auth.uid
  const verified = token.email_verified === true

  // 1. Роль
  const allowed = sellerEmails
    .value()
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  const isSeller = verified && !!token.email && allowed.includes(token.email.toLowerCase())
  const hasSellerClaim = token.role === 'seller'
  if (isSeller !== hasSellerClaim) {
    const auth = getAuth()
    const user = await auth.getUser(uid)
    const { role: _old, ...rest } = user.customClaims ?? {}
    await auth.setCustomUserClaims(uid, isSeller ? { ...rest, role: 'seller' } : rest)
    logger.info('Seller role updated', { uid, isSeller })
  }

  // 2. Вітальний бонус — прапорець welcomeGranted у тій самій транзакції гарантує «рівно один раз».
  let welcomeBonus = 0
  if (verified) {
    const db = getFirestore()
    welcomeBonus = await db.runTransaction(async (tx) => {
      const account = await tx.get(bonusAccountRef(db, uid))
      if (account.data()?.welcomeGranted) return 0
      applyBonus(tx, db, uid, WELCOME_BONUS, { type: 'welcome', orderId: '', orderNumber: '' }, { welcomeGranted: true })
      return WELCOME_BONUS
    })
    if (welcomeBonus) logger.info('Welcome bonus granted', { uid })
  }

  return {
    role: isSeller ? 'seller' : 'customer',
    changed: isSeller !== hasSellerClaim,
    welcomeBonus,
    emailVerified: verified,
  }
}, (r) => ({ resultRole: r.role, roleChanged: r.changed, welcomeBonus: r.welcomeBonus, emailVerified: r.emailVerified })))
