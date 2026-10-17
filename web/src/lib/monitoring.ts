type SentryModule = typeof import('@sentry/react')

/**
 * Моніторинг сайту через Sentry: помилки (з тим, що людина робила перед ними) і повільні сторінки.
 *
 * - DSN задається в web/.env.production (VITE_SENTRY_DSN). Без нього (локально) нічого нікуди не шлеться —
 *   події лише пишуться в консоль браузера, щоб їх було видно при розробці.
 * - Персональних даних не відправляємо: про користувача — лише uid і роль, без email, телефону й адреси.
 */
const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined
export const monitoringEnabled = !!dsn

/**
 * Sentry (~100 КБ) вантажимо окремо й лише коли він увімкнений — щоб не гальмувати перше відкриття сайту.
 * Події, що трапились до завантаження, складаємо в чергу й відправляємо, щойно він готовий.
 */
let sentry: SentryModule | null = null
const queue: ((s: SentryModule) => void)[] = []
const withSentry = (fn: (s: SentryModule) => void) => (sentry ? fn(sentry) : queue.push(fn))

export function initMonitoring() {
  if (!dsn) return
  void import('@sentry/react').then((Sentry) => {
    initSentry(Sentry)
    sentry = Sentry
    queue.splice(0).forEach((fn) => fn(Sentry))
  })
}

function initSentry(Sentry: SentryModule) {
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_APP_VERSION as string | undefined,
    // IP-адреси й cookies Sentry за замовчуванням не збирає; користувача задаємо лише через uid (нижче).
    integrations: [Sentry.browserTracingIntegration()],
    // 20% переходів між сторінками — для швидкодії; помилки відправляються всі.
    tracesSampleRate: 0.2,
    // Шум, який не залежить від нас: розширення браузера, втрата мережі.
    ignoreErrors: ['ResizeObserver loop', 'Network request failed', 'Failed to fetch dynamically imported module'],
  })
}

/** Хто зараз на сайті — щоб у Sentry знайти всі помилки конкретного покупця за uid. */
export function setMonitoringUser(user: { uid: string; role: string } | null) {
  if (!dsn) return
  withSentry((Sentry) => {
    Sentry.setUser(user ? { id: user.uid } : null)
    Sentry.setTag('role', user?.role ?? 'guest')
  })
}

/**
 * Дія користувача («додав у кошик», «оформив замовлення»). У Sentry видно як «хлібні крихти» перед помилкою:
 * що саме людина робила, перш ніж щось зламалось.
 */
export function track(action: string, data?: Record<string, unknown>) {
  if (import.meta.env.DEV) console.debug(`[track] ${action}`, data ?? '')
  if (!dsn) return
  withSentry((Sentry) => Sentry.addBreadcrumb({ category: 'user', message: action, data, level: 'info' }))
}

/** Помилка, яку ми зловили самі (напр. замовлення не створилось) — з контекстом, щоб зрозуміти причину. */
export function reportError(error: unknown, context: { action: string } & Record<string, unknown>) {
  console.error(`[${context.action}]`, error, context)
  if (!dsn) return
  withSentry((Sentry) =>
    Sentry.withScope((scope) => {
      scope.setTag('action', context.action)
      scope.setContext('details', context)
      Sentry.captureException(error)
    }),
  )
}
