import * as Sentry from '@sentry/node'
import { logger } from 'firebase-functions'
import { HttpsError, type CallableRequest } from 'firebase-functions/https'
import { defineString } from 'firebase-functions/params'

/**
 * Журнали й помилки бекенду.
 *
 * 1. Cloud Logging (завжди, безкоштовно): кожен виклик функції пише структурований запис —
 *    fn, uid, тривалість, результат. У Google Cloud Console → Logs Explorer можна знайти все,
 *    що відбувалось з покупцем: jsonPayload.uid="…", або з замовленням: jsonPayload.orderId="…".
 * 2. Sentry (якщо задано SENTRY_DSN у functions/.env): непередбачені помилки зі стеком і контекстом.
 *
 * Особисті дані (email, телефон, адреса) в журнали не пишемо — лише uid і номери замовлень.
 */
const sentryDsn = defineString('SENTRY_DSN', { default: '' })

let sentryReady: boolean | undefined
function sentry(): boolean {
  if (sentryReady === undefined) {
    const dsn = sentryDsn.value()
    sentryReady = !!dsn
    if (dsn) Sentry.init({ dsn, environment: process.env.FUNCTIONS_EMULATOR ? 'emulator' : 'production', tracesSampleRate: 0 })
  }
  return sentryReady
}

/** Помилки, які є нормальною частиною роботи (неправильні дані, немає на складі) — не баг, а попередження. */
const EXPECTED: HttpsError['code'][] = [
  'invalid-argument',
  'failed-precondition',
  'not-found',
  'permission-denied',
  'unauthenticated',
  'already-exists',
]

async function captureUnexpected(error: unknown, context: Record<string, unknown>) {
  logger.error(`${context.fn} failed`, {
    ...context,
    error: error instanceof Error ? { message: error.message, stack: error.stack } : String(error),
  })
  if (sentry()) {
    Sentry.withScope((scope) => {
      scope.setTag('fn', String(context.fn))
      if (context.uid) scope.setUser({ id: String(context.uid) })
      scope.setContext('details', context)
      Sentry.captureException(error)
    })
    // Функція може «заснути» одразу після відповіді — даємо Sentry відправити подію.
    await Sentry.flush(2000)
  }
}

/** Обгортка для onCall: журнал старту, успіху (з тривалістю й результатом) та помилок. */
export function withLogging<Req, Res>(
  fn: string,
  handler: (request: CallableRequest<Req>) => Promise<Res>,
  /** Що з результату варто записати в журнал (напр. номер замовлення), без особистих даних. */
  summarize?: (result: Res) => Record<string, unknown>,
) {
  return async (request: CallableRequest<Req>): Promise<Res> => {
    const started = Date.now()
    const ctx = { fn, uid: request.auth?.uid ?? null, role: (request.auth?.token.role as string | undefined) ?? 'customer' }
    logger.info(`${fn} called`, ctx)
    try {
      const result = await handler(request)
      logger.info(`${fn} ok`, { ...ctx, ms: Date.now() - started, ...summarize?.(result) })
      return result
    } catch (error) {
      if (error instanceof HttpsError && EXPECTED.includes(error.code)) {
        logger.warn(`${fn} rejected`, { ...ctx, ms: Date.now() - started, code: error.code, reason: error.message, details: error.details })
      } else {
        await captureUnexpected(error, { ...ctx, ms: Date.now() - started })
      }
      throw error
    }
  }
}

/** Обгортка для тригерів Firestore: помилка потрапляє в журнал і Sentry, а потім кидається далі (для повтору). */
export async function runTrigger<T>(fn: string, context: Record<string, unknown>, body: () => Promise<T>): Promise<T> {
  const started = Date.now()
  try {
    const result = await body()
    logger.info(`${fn} ok`, { fn, ...context, ms: Date.now() - started })
    return result
  } catch (error) {
    await captureUnexpected(error, { fn, ...context, ms: Date.now() - started })
    throw error
  }
}
