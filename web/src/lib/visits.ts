import { doc, increment, setDoc } from 'firebase/firestore'
import { useAuth } from '../features/auth/authStore'
import { db } from '../firebase/config'

/** День за київським часом: «2026-11-08» — назва документа visits/{день}. */
export const kyivDay = (d = new Date()) => d.toLocaleDateString('en-CA', { timeZone: 'Europe/Kyiv' })

const KEY = 'succulents.visitDay'

/**
 * Скільки людей зайшло на сайт за день (адмінка → «Покупці»): кожен браузер раз на добу додає +1 у visits/{день}.
 * Приблизно: приватне вікно чи інший браузер — ще одна людина; роботи без JavaScript не рахуються.
 * Продавця не рахуємо — тож чекаємо, поки стане відомо, хто зайшов.
 */
export function trackVisit() {
  const run = () => {
    if (useAuth.getState().role === 'seller') return
    const day = kyivDay()
    try {
      if (localStorage.getItem(KEY) === day) return
      // Позначаємо одразу — щоб кілька вкладок разом не порахували одну людину кілька разів
      localStorage.setItem(KEY, day)
    } catch {
      return // немає доступу до сховища браузера — не рахуємо, щоб не рахувати на кожній сторінці
    }
    setDoc(doc(db, 'visits', day), { count: increment(1) }, { merge: true }).catch(() => {
      try {
        localStorage.removeItem(KEY)
      } catch {
        /* нічого страшного */
      }
    })
  }
  if (!useAuth.getState().loading) return run()
  const stop = useAuth.subscribe((s) => {
    if (s.loading) return
    stop()
    run()
  })
}
