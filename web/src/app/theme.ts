import { useState } from 'react'
import { flushSync } from 'react-dom'

/**
 * Світла / темна тема. Вибір пам'ятає браузер (localStorage 'theme'); за замовчуванням — світла.
 * Темна — атрибут data-theme="dark" на <html> (кольори в index.css). Щоб сторінка не блимала світлою,
 * index.html ставить атрибут ще до завантаження сайту — ключ і колір для theme-color мають збігатися з ним.
 */
export type Theme = 'light' | 'dark'
const KEY = 'theme'
/** Колір панелі браузера на телефоні — як фон сторінки (sand-100) у кожній темі. */
const BAR_COLOR: Record<Theme, string> = { light: '#f7eddb', dark: '#14121d' }

function current(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

function apply(theme: Theme) {
  // Кнопки й картки мають власні анімації кольору (transition-colors тощо) — при зміні теми кожна перефарбовувалась
  // зі своєю швидкістю, і сторінка мигала. На мить їх вимикаємо, щоб усе змінилось разом (як next-themes)
  const off = document.createElement('style')
  off.textContent = '*,*::before,*::after{transition:none!important}'
  document.head.appendChild(off)
  if (theme === 'dark') document.documentElement.dataset.theme = 'dark'
  else delete document.documentElement.dataset.theme
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', BAR_COLOR[theme])
  // Браузер має застосувати нові кольори без анімацій — і лише потім анімації повертаються
  void window.getComputedStyle(document.body).color
  window.setTimeout(() => off.remove(), 1)
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    // Приватний режим — тема діятиме до перезавантаження, нічого страшного
  }
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(current)
  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    const swap = () => {
      apply(next)
      // Кнопка (місяць / сонце) міняється в тому ж кадрі, що й кольори
      flushSync(() => setTheme(next))
    }
    // Плавно: браузер робить знімок сторінки «до» і «після» й перетікає одним рухом (index.css, ::view-transition).
    // Окремі елементи не анімуються — тож нічого не блимає. Старі браузери й «менше руху» — просто миттєва зміна
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (document.startViewTransition && !reduced) document.startViewTransition(swap)
    else swap()
  }
  return { theme, toggle }
}
