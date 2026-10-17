import { useTranslation } from 'react-i18next'
import { Link, useLocation, useParams } from 'react-router'
import { useLang } from '../../i18n'
import { formatPrice } from '../../lib/format'
import { SucculentIcon } from '../../shared/ui'

export function OrderSuccessPage() {
  const { t } = useTranslation()
  const lang = useLang()
  const { number } = useParams()
  // Передається з CheckoutPage; після перезавантаження сторінки його вже немає — тоді просто не показуємо.
  const bonusEarned = (useLocation().state as { bonusEarned?: number } | null)?.bonusEarned ?? 0

  return (
    <div className="mx-auto max-w-xl rounded-[32px] bg-sand-50 px-6 py-12 text-center">
      <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-brand-100 text-brand-600">
        <SucculentIcon className="w-14" />
      </div>
      <h1 className="mt-6 font-display text-4xl font-extrabold text-brand-600">{t('success.title')}</h1>
      <p className="mt-4 inline-block rounded-full bg-sand-200 px-5 py-2 text-lg font-bold">
        {t('success.number', { number })}
      </p>
      <p className="mt-4 text-sand-700">{t('success.text')}</p>
      {bonusEarned > 0 && (
        <p className="mt-4 font-medium text-brand-600">{t('bonus.willEarn', { amount: formatPrice(bonusEarned, lang) })}</p>
      )}
      <Link to="/" className="mt-8 inline-block rounded-xl bg-brand-600 px-6 py-3.5 font-bold text-sand-50 hover:bg-brand-700">
        {t('success.continue')}
      </Link>
    </div>
  )
}
