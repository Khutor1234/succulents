import { BarChart3, ClipboardList, Package, Tags, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { NavLink, Outlet } from 'react-router'
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

export function AdminLayout() {
  const { t } = useTranslation()
  const { data: orders } = useOrders()
  const newCount = orders?.filter((o) => o.status === 'new').length ?? 0

  return (
    <div>
      {/* Телефон: «Замовлення» — велика кнопка на всю ширину зверху, решта вкладок гортається вбік.
          Комп'ютер: каталог зліва, «Замовлення» праворуч. */}
      <nav className="mb-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:overflow-visible sm:px-0 sm:pb-0">
          {TABS.map(({ to, label, Icon }) => (
            <NavLink key={to} to={to} className={tab}>
              <Icon {...ICON} />
              {t(label)}
            </NavLink>
          ))}
        </div>

        <NavLink
          to="/admin/orders"
          className={({ isActive }) =>
            `flex min-h-13 items-center justify-center gap-2.5 rounded-2xl px-5 py-3 text-lg font-extrabold shadow-sm transition-[background-color,transform] active:scale-[0.98] sm:ml-auto ${
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
