import { Clock, Package, Wallet } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ICON } from '../../shared/icon'
import { useLang } from '../../i18n'
import { formatPrice } from '../../lib/format'
import type { Order } from '../../lib/types'
import { PageTitle } from '../../shared/ui'
import { OrderItems } from '../orders/OrderItems'
import { OrderTotals } from '../orders/OrderTotals'
import { useBonusBalance, useBonusHistory, useMyOrders } from './api'
import { DeliveryProfileSection } from './DeliveryProfileForm'

const STATUS_COLORS: Record<Order['status'], string> = {
  new: 'bg-sand-300',
  confirmed: 'bg-brand-100',
  shipped: 'bg-brand-100',
  done: 'bg-brand-600 text-sand-50',
  cancelled: 'bg-sand-200 text-sand-700',
}

function formatDate(order: { createdAt?: { toDate(): Date } }) {
  return order.createdAt?.toDate().toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' }) ?? ''
}

export function AccountPage() {
  const { t } = useTranslation()
  const lang = useLang()
  const { balance } = useBonusBalance()
  const history = useBonusHistory()
  const orders = useMyOrders()

  return (
    <div className="space-y-10">
      <PageTitle>{t('account.title')}</PageTitle>

      <section className="grid gap-5 md:grid-cols-[1fr_1.4fr]">
        <div className="flex flex-col justify-between gap-6 rounded-[32px] bg-sunset-600 p-8 text-sand-50">
          <p className="flex items-center gap-2 text-[13px] font-bold tracking-[0.14em] uppercase">
            <Wallet {...ICON} />
            {t('account.balance')}
          </p>
          <p className="font-display text-6xl font-extrabold">{formatPrice(balance, lang)}</p>
          <p className="text-sm leading-relaxed">{t('account.balanceHint')}</p>
        </div>

        <div className="rounded-[32px] border-2 border-sand-200 bg-sand-50 p-6">
          <h2 className="mb-4 flex items-center gap-2 font-display text-2xl font-extrabold text-brand-600">
            <Clock {...ICON} />
            {t('account.history')}
          </h2>
          {history.isLoading && <p className="text-sand-700">{t('loading')}</p>}
          {history.data?.length === 0 && <p className="text-sand-700">{t('account.noHistory')}</p>}
          <ul className="divide-y-2 divide-sand-200">
            {history.data?.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-4 py-3">
                <span>
                  <span className="block font-medium">{t(`account.entry.${e.type}`, { number: e.orderNumber })}</span>
                  <span className="text-sm text-sand-700">{formatDate(e)}</span>
                </span>
                <span className={`font-display text-lg font-extrabold whitespace-nowrap ${e.amount > 0 ? 'text-brand-600' : 'text-sunset-600'}`}>
                  {e.amount > 0 ? '+' : '−'}
                  {formatPrice(Math.abs(e.amount), lang)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <DeliveryProfileSection />

      <section>
        <h2 className="mb-4 flex items-center gap-2 font-display text-3xl font-extrabold text-brand-600">
          <Package size={26} strokeWidth={2.25} aria-hidden />
          {t('account.orders')}
        </h2>
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
      </section>
    </div>
  )
}
