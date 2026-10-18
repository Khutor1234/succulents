import { BarChart3, ClipboardList, FileSpreadsheet, MoreHorizontal, Package, Sparkles, Tags, Users, X, type LucideIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink, Outlet, useLocation } from 'react-router'
import { ICON } from '../../shared/icon'
import { useOrders } from './api'

const TABS = [
  { to: '/admin/products', label: 'admin.products', Icon: Package },
  { to: '/admin/categories', label: 'admin.categories', Icon: Tags },
  { to: '/admin/customers', label: 'admin.customers.title', Icon: Users },
  { to: '/admin/analytics', label: 'analytics.title', Icon: BarChart3 },
] as const

// Телефон: у нижній панелі — найчастіше потрібне, решта — під «Ще»
const MORE: { to: string; label: string; Icon: LucideIcon }[] = [
  { to: '/admin/categories', label: 'admin.categories', Icon: Tags },
  { to: '/admin/customers', label: 'admin.customers.title', Icon: Users },
  { to: '/admin/import', label: 'admin.importFromSheet', Icon: FileSpreadsheet },
  { to: '/admin/forms', label: 'admin.formFixes.title', Icon: Sparkles },
]

const tab = ({ isActive }: { isActive: boolean }) =>
  `inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-4 font-bold whitespace-nowrap transition-colors ${
    isActive ? 'bg-brand-600 text-sand-50' : 'bg-sand-200 text-ink hover:bg-sand-300'
  }`

export function AdminLayout() {
  const { t } = useTranslation()
  const { data: orders } = useOrders()
  const newCount = orders?.filter((o) => o.status === 'new').length ?? 0
  const { pathname } = useLocation()
  // У формі товару внизу вже є панель «Зберегти» — нижнє меню там не показуємо
  const inForm = /^\/admin\/products\/.+/.test(pathname)
  // Меню «Ще» відкрите лише на тій сторінці, де його відкрили: перейшли деінде — воно само закрилось
  const [openOn, setOpenOn] = useState<string | null>(null)
  const moreOpen = openOn === pathname
  const moreActive = MORE.some((m) => pathname.startsWith(m.to))

  // Місце під нижнє меню, щоб воно не закривало низ сторінки (див. index.css)
  useEffect(() => {
    if (inForm) return
    document.documentElement.classList.add('admin-bottom-nav')
    return () => document.documentElement.classList.remove('admin-bottom-nav')
  }, [inForm])

  return (
    <div>
      {/* Комп'ютер і планшет: вкладки каталогу зліва, «Замовлення» праворуч */}
      <nav className="mb-6 hidden items-center gap-3 sm:flex">
        <div className="flex gap-2">
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
            `ml-auto flex min-h-13 items-center justify-center gap-2.5 rounded-2xl px-5 py-3 text-lg font-extrabold shadow-sm transition-[background-color,transform] active:scale-[0.98] ${
              isActive ? 'bg-sunset-700 text-sand-50 ring-4 ring-sunset-500/40' : 'bg-sunset-600 text-sand-50 hover:bg-sunset-700'
            }`
          }
        >
          <ClipboardList size={24} strokeWidth={2.2} aria-hidden />
          {t('admin.orders')}
          {newCount > 0 && <NewBadge count={newCount} />}
        </NavLink>
      </nav>

      <Outlet />

      {/* Телефон: нижнє меню, як у застосунках — завжди під пальцем, не займає місця вгорі сторінки */}
      {!inForm && (
        <nav
          aria-label={t('admin.menu')}
          className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-sand-200 bg-sand-50/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md sm:hidden"
        >
          {moreOpen && (
            <div className="absolute inset-x-3 bottom-full mb-2 animate-rise rounded-3xl border-2 border-sand-200 bg-sand-50 p-2 shadow-[0_-12px_30px_-12px_rgba(43,33,24,0.3)]">
              {MORE.map(({ to, label, Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `flex min-h-12 items-center gap-3 rounded-2xl px-4 font-bold ${isActive ? 'bg-brand-600 text-sand-50' : 'text-ink hover:bg-sand-200'}`
                  }
                >
                  <Icon {...ICON} />
                  {t(label)}
                </NavLink>
              ))}
            </div>
          )}
          <div className="grid grid-cols-4">
            <BottomLink to="/admin/products" icon={Package} label={t('admin.products')} />
            <BottomLink to="/admin/orders" icon={ClipboardList} label={t('admin.orders')} badge={newCount} />
            <BottomLink to="/admin/analytics" icon={BarChart3} label={t('analytics.title')} />
            <button
              type="button"
              onClick={() => setOpenOn(moreOpen ? null : pathname)}
              aria-expanded={moreOpen}
              className={`flex min-h-16 flex-col items-center justify-center gap-0.5 text-xs font-bold ${moreActive || moreOpen ? 'text-brand-600' : 'text-sand-700'}`}
            >
              {moreOpen ? <X size={22} strokeWidth={2.2} aria-hidden /> : <MoreHorizontal size={22} strokeWidth={2.2} aria-hidden />}
              {t('admin.more')}
            </button>
          </div>
        </nav>
      )}
    </div>
  )
}

function NewBadge({ count, small }: { count: number; small?: boolean }) {
  const { t } = useTranslation()
  return (
    <span
      key={count}
      className={`inline-flex animate-pop justify-center rounded-full font-extrabold ${
        small ? 'absolute -top-1 left-1/2 ml-2 min-w-5 bg-sunset-600 px-1 text-[11px] leading-5 text-sand-50' : 'min-w-7 bg-sand-50 px-2 text-sm leading-7 text-sunset-600'
      }`}
      aria-label={t('admin.newOrdersCount', { count })}
    >
      {count}
    </span>
  )
}

function BottomLink({ to, icon: Icon, label, badge = 0 }: { to: string; icon: LucideIcon; label: string; badge?: number }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex min-h-16 flex-col items-center justify-center gap-0.5 text-xs font-bold ${isActive ? 'text-brand-600' : 'text-sand-700'}`
      }
    >
      <span className="relative">
        <Icon size={22} strokeWidth={2.2} aria-hidden />
        {badge > 0 && <NewBadge count={badge} small />}
      </span>
      {label}
    </NavLink>
  )
}
