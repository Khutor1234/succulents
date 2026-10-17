import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useAuth } from '../auth/authStore'
import { useOrders } from './api'

/** Видно лише продавцю: на головній одразу показує, скільки нових замовлень, і веде до них. */
export function SellerOrdersPanel() {
  const role = useAuth((s) => s.role)
  if (role !== 'seller') return null
  return <Panel />
}

function Panel() {
  const { t } = useTranslation()
  const { data: orders } = useOrders()
  const count = (status: string) => orders?.filter((o) => o.status === status).length ?? 0
  const fresh = count('new')
  const inWork = count('confirmed') + count('shipped')

  return (
    <section className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-[32px] bg-ink px-6 py-5 text-sand-100 sm:px-8">
      <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-sunset-500" aria-hidden="true">
        <path d="M21 8l-9-5-9 5 9 5 9-5z" />
        <path d="M3 8v8l9 5 9-5V8" />
        <path d="M12 13v8" />
      </svg>
      <div className="min-w-48 flex-1">
        <p className="font-display text-2xl font-extrabold text-sand-50">
          {fresh > 0 ? t('seller.newOrders', { count: fresh }) : t('seller.noNewOrders')}
        </p>
        {inWork > 0 && <p className="text-sm text-sand-300">{t('seller.inWork', { count: inWork })}</p>}
      </div>
      <Link
        to="/admin/orders"
        className="flex items-center gap-2 rounded-2xl bg-sunset-600 px-6 py-3.5 text-lg font-extrabold text-sand-50 hover:bg-sunset-700"
      >
        {t('admin.orders')}
        {fresh > 0 && (
          <span className="inline-flex min-w-7 justify-center rounded-full bg-sand-50 px-2 text-sm leading-7 text-sunset-600">{fresh}</span>
        )}
      </Link>
    </section>
  )
}
