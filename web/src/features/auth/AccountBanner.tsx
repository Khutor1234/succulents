import { sendEmailVerification } from 'firebase/auth'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useLang } from '../../i18n'
import { formatPrice } from '../../lib/format'
import { useAuth } from './authStore'

/**
 * Смужка під шапкою:
 * - «Вітаємо, нараховано 100 грн» — одразу після вітального бонусу;
 * - «Підтвердіть email» — для тих, хто зареєструвався паролем і ще не підтвердив пошту (бонус чекає на це).
 */
export function AccountBanner() {
  const { t } = useTranslation()
  const lang = useLang()
  const { user, welcomeBonus, dismissWelcome, resync } = useAuth()
  const [sent, setSent] = useState(false)
  const [checking, setChecking] = useState(false)

  if (welcomeBonus > 0) {
    return (
      <div role="status" className="animate-toast-in bg-brand-600 text-sand-50">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <p className="flex-1 font-medium">
            🎉 {t('welcome.granted', { amount: formatPrice(welcomeBonus, lang) })}
          </p>
          <Link to="/account" onClick={dismissWelcome} className="rounded-xl bg-sand-50 px-4 py-2 font-bold text-ink">
            {t('welcome.toAccount')}
          </Link>
          <button onClick={dismissWelcome} aria-label={t('cart.closeToast')} className="min-h-10 rounded-xl px-3 font-bold hover:bg-brand-700">
            ✕
          </button>
        </div>
      </div>
    )
  }

  if (user && !user.emailVerified) {
    return (
      <div className="bg-sand-300">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-sm">
          <p className="flex-1">{t('welcome.verify', { email: user.email })}</p>
          <button
            disabled={sent}
            onClick={() => void sendEmailVerification(user).then(() => setSent(true))}
            className="min-h-10 rounded-xl bg-sand-50 px-3 font-bold disabled:opacity-60"
          >
            {sent ? t('welcome.sent') : t('welcome.resend')}
          </button>
          <button
            disabled={checking}
            onClick={() => {
              setChecking(true)
              void resync().finally(() => setChecking(false))
            }}
            className="min-h-10 rounded-xl bg-brand-600 px-3 font-bold text-sand-50"
          >
            {t('welcome.verified')}
          </button>
        </div>
      </div>
    )
  }

  return null
}
