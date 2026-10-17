import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { useEffect } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { db } from '../../firebase/config'
import { useAuth } from '../auth/authStore'

/** Більше не зберігаємо — щоб документ користувача не розростався (те саме обмеження в правилах Firestore). */
const MAX = 300

interface FavoritesState {
  /** id товарів, найновіші — першими */
  ids: string[]
  toggle: (productId: string) => void
}

// Під яким акаунтом зберігати зміни в базі (null — гість або ще не звірились із базою)
let syncUid: string | null = null

function save(ids: string[]) {
  if (!syncUid) return
  // Не вдалося зберегти в акаунті — не страшно: список лишається в браузері, збережеться наступного разу
  void setDoc(doc(db, 'users', syncUid), { favorites: ids, updatedAt: serverTimestamp() }, { merge: true }).catch(() => {})
}

/**
 * Улюблені рослини. Працює й без входу (зберігається в браузері),
 * а з входом — ще й в акаунті, тож список той самий на телефоні й комп'ютері.
 */
export const useFavorites = create<FavoritesState>()(
  persist(
    (set, get) => ({
      ids: [],
      toggle: (productId) => {
        const current = get().ids
        const ids = current.includes(productId) ? current.filter((id) => id !== productId) : [productId, ...current].slice(0, MAX)
        set({ ids })
        save(ids)
      },
    }),
    { name: 'favorites' },
  ),
)

/** Після входу об'єднує улюблене з браузера й з акаунта (нічого не губиться) і далі зберігає зміни в акаунт. */
export function useFavoritesSync() {
  const uid = useAuth((s) => s.user?.uid)
  useEffect(() => {
    syncUid = null
    if (!uid) return
    let cancelled = false
    getDoc(doc(db, 'users', uid))
      .then((snap) => {
        if (cancelled) return
        const remote = (snap.data()?.favorites as string[] | undefined) ?? []
        const merged = [...new Set([...useFavorites.getState().ids, ...remote])].slice(0, MAX)
        useFavorites.setState({ ids: merged })
        syncUid = uid
        if (merged.length !== remote.length || merged.some((id, i) => id !== remote[i])) save(merged)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [uid])
}
