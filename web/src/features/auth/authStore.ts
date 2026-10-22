import { onIdTokenChanged, type User } from 'firebase/auth'
import { httpsCallable } from 'firebase/functions'
import { create } from 'zustand'
import { queryClient } from '../../app/queryClient'
import { auth, functions } from '../../firebase/config'
import { reportError, setMonitoringUser, track } from '../../lib/monitoring'

export type Role = 'customer' | 'seller'

interface AuthState {
  user: User | null
  role: Role
  /** true, поки Firebase ще не відповів, чи є залогінений користувач. */
  loading: boolean
  /** Скільки вітальних бонусів щойно нараховано (для банера «Вітаємо!»). 0 — нічого не показуємо. */
  welcomeBonus: number
  dismissWelcome: () => void
  /** Ще раз звірити акаунт із сервером — напр. після підтвердження email. */
  resync: () => Promise<void>
}

interface SyncResult {
  role: Role
  changed: boolean
  welcomeBonus: number
  emailVerified: boolean
}

const syncAccount = httpsCallable<void, SyncResult>(functions, 'syncAccount')
// Звіряємо акаунт із сервером один раз за сесію для кожного користувача.
const synced = new Set<string>()

async function sync(user: User) {
  try {
    // Пошту підтвердили за посиланням у листі, а збережений токен ще старий (email_verified = false) —
    // без оновлення сервер не нарахує вітальний бонус, а смужки з кнопкою «Я підтвердила» вже немає.
    if (user.emailVerified && (await user.getIdTokenResult()).claims.email_verified !== true) {
      await user.getIdToken(true)
    }
    const { data } = await syncAccount()
    if (data.welcomeBonus > 0) {
      track('welcome_bonus_granted', { amount: data.welcomeBonus })
      useAuth.setState({ welcomeBonus: data.welcomeBonus })
      void queryClient.invalidateQueries({ queryKey: ['bonuses'] })
    }
    // Роль змінилась на сервері — оновлюємо токен; onIdTokenChanged спрацює ще раз уже з новою роллю.
    if (data.changed) await user.getIdToken(true)
  } catch (e) {
    reportError(e, { action: 'account_sync' })
  }
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  role: 'customer',
  loading: true,
  welcomeBonus: 0,
  dismissWelcome: () => set({ welcomeBonus: 0 }),
  resync: async () => {
    const user = auth.currentUser
    if (!user) return
    await user.reload()
    await user.getIdToken(true) // свіжий токен з email_verified = true
    useAuth.setState({ user: auth.currentUser })
    await sync(user)
  },
}))

/**
 * Продавці зі списку VITE_SELLER_EMAILS (з підтвердженим email) бачать адмінку, навіть поки сервер ще не видав
 * їм роль. Це лише показ кнопок: доступ до даних однаково перевіряють правила Firestore за тим самим списком.
 */
const SELLER_EMAILS = (import.meta.env.VITE_SELLER_EMAILS ?? '')
  .split(',')
  .map((e: string) => e.trim().toLowerCase())
  .filter(Boolean)
const isListedSeller = (user: User) => user.emailVerified && !!user.email && SELLER_EMAILS.includes(user.email.toLowerCase())

// Роль береться з custom claims токена — клієнт не може її підробити.
onIdTokenChanged(auth, async (user) => {
  if (!user) {
    useAuth.setState({ user: null, role: 'customer', loading: false })
    setMonitoringUser(null)
    return
  }
  const token = await user.getIdTokenResult()
  const role: Role = token.claims.role === 'seller' || isListedSeller(user) ? 'seller' : 'customer'
  useAuth.setState({ user, role, loading: false })
  setMonitoringUser({ uid: user.uid, role })

  if (!synced.has(user.uid)) {
    synced.add(user.uid)
    await sync(user)
  }
})
