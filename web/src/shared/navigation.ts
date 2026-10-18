import { useLocation } from 'react-router'

/** Поточна адреса разом із фільтрами й пошуком (?q=…&sort=…) — щоб потім повернутися саме сюди. */
export function useHere() {
  const { pathname, search } = useLocation()
  return pathname + search
}

/** Чи є куди «Назад» у межах сайту (react-router рахує переходи: idx > 0 — є попередня сторінка сайту). */
export const canGoBack = () => ((window.history.state as { idx?: number } | null)?.idx ?? 0) > 0

/** Звідки прийшли на сторінку редагування — передається в state посилання «Редагувати» / «Копія». */
export function useFrom(): string | undefined {
  const state = useLocation().state as { from?: unknown } | null
  return typeof state?.from === 'string' ? state.from : undefined
}

// Останній запит пошуку магазину — щоб «Пошук» у меню відкривався з ним, а не порожнім.
// sessionStorage: живе, поки відкрита вкладка; у приватному режимі може бути недоступний — тоді просто без пам’яті.
const SEARCH_KEY = 'lastSearch'
export function rememberSearch(q: string) {
  try {
    if (q) sessionStorage.setItem(SEARCH_KEY, q)
    else sessionStorage.removeItem(SEARCH_KEY)
  } catch {
    /* немає доступу до сховища */
  }
}
/** Адреса сторінки пошуку з останнім запитом (або порожня). */
export function searchHref() {
  try {
    const q = sessionStorage.getItem(SEARCH_KEY)
    return q ? `/search?q=${encodeURIComponent(q)}` : '/search'
  } catch {
    return '/search'
  }
}
