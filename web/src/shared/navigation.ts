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
/**
 * Відкрити клавіатуру одразу при натисканні на «Пошук» (телефон). iPhone показує клавіатуру лише тоді, коли поле
 * отримує фокус прямо в обробнику натискання, а сторінка пошуку з’являється вже після нього. Тому в мить натискання
 * фокусуємо тимчасове невидиме поле (клавіатура відкривається), а SearchPage переводить фокус у справжнє —
 * клавіатура при цьому не ховається. Викликати з onClick посилань на пошук.
 */
let keyboardPrimer: HTMLInputElement | null = null
export function openSearchKeyboard() {
  if (!window.matchMedia('(pointer: coarse)').matches) return
  // Уже на сторінці пошуку — просто фокусуємо поле (теж у межах натискання)
  const field = document.querySelector<HTMLInputElement>('input[data-search-field]')
  if (field) {
    field.focus()
    return
  }
  keyboardPrimer?.remove()
  const el = document.createElement('input')
  el.type = 'search'
  el.tabIndex = -1
  el.setAttribute('aria-hidden', 'true')
  // 16px — щоб iPhone не наближав сторінку; майже нульовий розмір і прозорість — поля не видно
  el.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;font-size:16px;border:0;padding:0'
  document.body.appendChild(el)
  el.focus({ preventScroll: true })
  keyboardPrimer = el
  // Сторінка пошуку так і не відкрилась — прибираємо тимчасове поле
  setTimeout(() => {
    if (keyboardPrimer === el) releaseSearchKeyboard()
  }, 3000)
}
/** Справжнє поле пошуку вже у фокусі — тимчасове більше не потрібне. */
export function releaseSearchKeyboard() {
  keyboardPrimer?.remove()
  keyboardPrimer = null
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
