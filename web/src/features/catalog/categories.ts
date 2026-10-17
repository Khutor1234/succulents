import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { DEFAULT_CATEGORIES, type Category } from '../../lib/types'

/** Документ settings/categories у Firestore: список категорій у порядку показу. */
export interface CategorySetting {
  id: Category
  name: string
  visible: boolean
}

const settingsRef = () => doc(db, 'settings', 'categories')
const DEFAULTS: CategorySetting[] = DEFAULT_CATEGORIES.map((c) => ({ ...c, visible: true }))

export function useCategories() {
  const query = useQuery({
    queryKey: ['settings', 'categories'],
    queryFn: async () => {
      const snap = await getDoc(settingsRef())
      const items = snap.data()?.items as Partial<CategorySetting>[] | undefined
      if (!items) return DEFAULTS
      // Старі записи могли бути без назви — беремо стандартну назву або сам id.
      return items
        .filter((c): c is Partial<CategorySetting> & { id: string } => typeof c.id === 'string')
        .map((c) => ({
          id: c.id,
          name: c.name ?? DEFAULT_CATEGORIES.find((d) => d.id === c.id)?.name ?? c.id,
          visible: c.visible ?? true,
        }))
    },
  })
  // Поки налаштування вантажаться — стартовий список, щоб меню не блимало порожнім.
  const all = query.data ?? DEFAULTS
  const visible = all.filter((c) => c.visible).map((c) => c.id)
  return {
    all,
    visible,
    exists: (id: Category) => all.some((c) => c.id === id),
    isVisible: (id: Category) => visible.includes(id),
    /** Назва для показу; якщо категорію видалили — показуємо сам id, щоб нічого не ламалось. */
    nameOf: (id: Category) => all.find((c) => c.id === id)?.name ?? id,
    isLoading: query.isLoading,
  }
}

export function useSaveCategories() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (items: CategorySetting[]) => setDoc(settingsRef(), { items, updatedAt: serverTimestamp() }),
    onSuccess: () => queryClient.invalidateQueries(),
  })
}
