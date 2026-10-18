import { ArrowLeft, ChevronRight, Clock, Heart, Package, Wallet } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { ICON } from '../../shared/icon'
import { useLang } from '../../i18n'
import { formatPrice } from '../../lib/format'
import { PageTitle } from '../../shared/ui'
import { useBonusBalance, useBonusHistory, useMyOrders } from './api'
import { useFavorites } from '../favorites/favoritesStore'
import { CareGuide } from './CareGuide'
import { DeliveryProfileSection } from './DeliveryProfileForm'

export function formatDate(order: { createdAt?: { toDate(): Date } }) {
  return order.createdAt?.toDate().toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' }) ?? ''
}

/** Посилання «← Кабінет» над окремими екранами кабінету. */
export function BackToAccount() {
  const { t } = useTranslation()
  return (
    <Link to="/account" className="group mb-4 inline-flex items-center gap-1.5 font-bold text-brand-600 hover:underline">
      <ArrowLeft {...ICON} className="transition-transform group-hover:-translate-x-1" />
      {t('account.title')}
    </Link>
  )
}

/** Велика кнопка-плитка в кабінеті, що веде на окремий екран. */
function Tile({ to, icon, title, hint }: { to: string; icon: ReactNode; title: string; hint: string }) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-4 rounded-[28px] border-2 border-sand-200 bg-sand-50 p-5 transition-[transform,border-color] hover:-translate-y-0.5 hover:border-brand-500"
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-100 text-brand-600">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-xl font-extrabold text-brand-600">{title}</span>
        <span className="block text-sm text-sand-700">{hint}</span>
      </span>
      <ChevronRight {...ICON} className="shrink-0 text-sand-700 transition-transform group-hover:translate-x-1" />
    </Link>
  )
}

export function AccountPage() {
  const { t } = useTranslation()
  const lang = useLang()
  const { balance } = useBonusBalance()
  const history = useBonusHistory()
  const orders = useMyOrders()
  const favorites = useFavorites((s) => s.ids.length)

  return (
    <div className="space-y-10">
      <PageTitle>{t('account.title')}</PageTitle>

      <nav className="-mt-4 grid gap-3 sm:grid-cols-2" aria-label={t('account.title')}>
        <Tile
          to="/account/favorites"
          icon={<Heart {...ICON} />}
          title={t('favorites.title')}
          hint={favorites ? t('favorites.summary', { count: favorites }) : t('favorites.tileEmpty')}
        />
        <Tile
          to="/account/orders"
          icon={<Package {...ICON} />}
          title={t('account.orders')}
          hint={orders.data?.length ? t('account.ordersCount', { count: orders.data.length }) : t('account.noOrdersShort')}
        />
      </nav>

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

      <CareGuide />

      <DeliveryProfileSection />
    </div>
  )
}
