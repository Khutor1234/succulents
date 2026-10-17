import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { queryClient } from './app/queryClient'
import { router } from './app/router'
import './i18n'
import './index.css'
import { initMonitoring } from './lib/monitoring'

// Першим ділом — щоб Sentry зловив навіть помилки під час запуску сайту.
initMonitoring()

// Після публікації нової версії старих файлів сайту вже немає. Якщо відкрита сторінка
// не змогла довантажити частину сайту — один раз перезавантажуємо її, щоб отримати нову версію.
window.addEventListener('vite:preloadError', (e) => {
  try {
    if (sessionStorage.getItem('reloadedForUpdate')) return
    sessionStorage.setItem('reloadedForUpdate', '1')
  } catch {
    return
  }
  e.preventDefault()
  window.location.reload()
})
window.addEventListener('load', () => {
  try {
    setTimeout(() => sessionStorage.removeItem('reloadedForUpdate'), 10_000)
  } catch {
    /* немає доступу до сховища — нічого страшного */
  }
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
