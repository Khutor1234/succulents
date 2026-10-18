import { BarChart3, ClipboardList, Package, Store, Tags, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, NavLink, Outlet } from 'react-router'
import { ICON } from '../../shared/icon'
import { useOrders } from './api'

const TABS = [
  { to: '/admin/products', label: 'admin.products', Icon: Package },
  { to: '/admin/categories', label: 'admin.categories', Icon: Tags },
  { to: '/admin/customers', label: 'admin.customers.title', Icon: Users },
  { to: '/admin/analytics', label: 'analytics.title', Icon: BarChart3 },
] as const

const tab = ({ isActive }: { isActive: boolean }) =>
  `inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-4 font-bold whitespace-nowrap transition-colors ${
    isActive ? 'bg-brand-600 text-sand-50' : 'bg-sand-200 text-ink hover:bg-sand-300'
  }`

/**
 * Каркас адмінки. Комп'ютер: вкладки зліва, «До магазину» і «Замовлення» праворуч.
 * Телефон: верхніх вкладок немає — усі розділи в нижньому меню (app/BottomNav, однакове з магазином).
 */
export function AdminLayout() {
  const { t } = useTranslation()
  const { data: orders } = useOrders()
  const newCount = orders?.filter((o) => o.status === 'new').length ?? 0

  return (
    <div>
      <nav className="mb-6 hidden items-center gap-3 md:flex">
        <div className="flex gap-2">
          {TABS.map(({ to, label, Icon }) => (
            <NavLink key={to} to={to} className={tab}>
              <Icon {...ICON} />
              {t(label)}
            </NavLink>
          ))}
        </div>
        {/* Швидкий перехід на вітрину — подивитися магазин очима покупця */}
        <Link
          to="/"
          className="ml-auto inline-flex min-h-13 items-center gap-2 rounded-2xl border-2 border-brand-600 px-4 font-bold text-brand-600 transition-colors hover:bg-brand-600 hover:text-sand-50"
        >
          <Store {...ICON} />
          {t('admin.toShop')}
        </Link>
        <NavLink
          to="/admin/orders"
          className={({ isActive }) =>
            `flex min-h-13 items-center justify-center gap-2.5 rounded-2xl px-5 py-3 text-lg font-extrabold shadow-sm transition-[background-color,transform] active:scale-[0.98] ${
              isActive ? 'bg-sunset-700 text-sand-50 ring-4 ring-sunset-500/40' : 'bg-sunset-600 text-sand-50 hover:bg-sunset-700'
            }`
          }
        >
          <ClipboardList size={24} strokeWidth={2.2} aria-hidden />
          {t('admin.orders')}
          {newCount > 0 && (
            <span
              key={newCount}
              className="inline-flex min-w-7 animate-pop justify-center rounded-full bg-sand-50 px-2 text-sm leading-7 text-sunset-600"
              aria-label={t('admin.newOrdersCount', { count: newCount })}
            >
              {newCount}
            </span>
          )}
        </NavLink>
      </nav>
      <Outlet />
    </div>
  )
}
