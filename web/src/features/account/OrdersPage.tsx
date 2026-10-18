import { useTranslation } from 'react-i18next'
import { useLang } from '../../i18n'
import { formatPrice } from '../../lib/format'
import type { Order } from '../../lib/types'
import { PageTitle } from '../../shared/ui'
import { OrderItems } from '../orders/OrderItems'
import { OrderTotals } from '../orders/OrderTotals'
import { BackToAccount, formatDate } from './AccountPage'
import { useMyOrders } from './api'
import { CareGuide } from './CareGuide'

const STATUS_COLORS: Record<Order['status'], string> = {
  new: 'bg-sand-300',
  confirmed: 'bg-brand-100',
  shipped: 'bg-brand-100',
  done: 'bg-brand-600 text-sand-50',
  cancelled: 'bg-sand-200 text-sand-700',
}

/** «Мої замовлення» — окремий екран кабінету. */
export function OrdersPage() {
  const { t } = useTranslation()
  const lang = useLang()
  const orders = useMyOrders()

  return (
    <div>
      <BackToAccount />
      <PageTitle>{t('account.orders')}</PageTitle>
      {orders.isLoading && <p className="text-sand-700">{t('loading')}</p>}
      {orders.isError && <p className="text-red-700">{t('errors.loading')}</p>}
      {orders.data?.length === 0 && <p className="text-sand-700">{t('account.noOrders')}</p>}
      <ul className="space-y-3">
        {orders.data?.map((o) => (
          <li key={o.id} className="rounded-3xl border-2 border-sand-200 bg-sand-50 p-5">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="font-display text-xl font-extrabold">{o.number}</span>
              <span className={`rounded-full px-3 py-1 text-sm font-bold ${STATUS_COLORS[o.status]}`}>
                {t(`admin.statuses.${o.status}`)}
              </span>
              <span className="text-sm text-sand-700">{formatDate(o)}</span>
              <span className="ml-auto font-display text-xl font-extrabold text-sunset-600">{formatPrice(o.total, lang)}</span>
            </div>
            <div className="mt-3">
              <OrderItems items={o.items} />
            </div>
            {o.adjustedAt && <p className="text-sm text-sand-700">{t('orders.adjusted')}</p>}
            {((o.bonusUsed ?? 0) > 0 || (o.adjustment ?? 0) !== 0) && <OrderTotals order={o} />}
            {(o.bonusEarned ?? 0) > 0 && o.status !== 'cancelled' && (
              <p className="mt-2 text-sm font-bold text-brand-600">
                {o.bonusCredited
                  ? t('account.creditedBonus', { amount: formatPrice(o.bonusEarned!, lang) })
                  : t('account.pendingBonus', { amount: formatPrice(o.bonusEarned!, lang) })}
              </p>
            )}
          </li>
        ))}
      </ul>
      {/* Пам’ятка з догляду — завжди під рукою поруч із замовленнями */}
      <div className="mt-8">
        <CareGuide />
      </div>
    </div>
  )
}
