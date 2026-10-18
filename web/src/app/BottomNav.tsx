import {
  BarChart3,
  ClipboardList,
  FileSpreadsheet,
  Home,
  LayoutGrid,
  LogIn,
  MoreHorizontal,
  Package,
  Search,
  ShoppingBag,
  Sparkles,
  Store,
  Tags,
  User,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink, useLocation } from 'react-router'
import { useOrders } from '../features/admin/api'
import { useAuth } from '../features/auth/authStore'
import { selectCount, useCart } from '../features/cart/cartStore'
import { searchHref } from '../shared/navigation'

/**
 * Нижнє меню на телефоні — як у застосунках: найпотрібніше завжди під пальцем. Одне й те саме на всіх сторінках:
 * - покупцю: головна, каталог, пошук, кошик, кабінет (або «Увійти»);
 * - продавцю (і в магазині, і в адмінці): магазин, товари, замовлення, аналітика й «Ще» з рештою розділів.
 * У формі товару не показуємо — там унизу своя панель «Зберегти».
 */
export function BottomNav() {
  const isSeller = useAuth((s) => s.role === 'seller')
  const { pathname } = useLocation()
  const hidden = /^\/admin\/products\/.+/.test(pathname)

  const typing = useTyping()

  // Місце під меню внизу сторінки (див. index.css)
  useEffect(() => {
    if (hidden) return
    document.documentElement.classList.add('shop-bottom-nav')
    return () => document.documentElement.classList.remove('shop-bottom-nav')
  }, [hidden])
  // Поки відкрита клавіатура (людина друкує в полі) — меню ховаємо: на телефоні воно «злітає» над клавіатурою
  // і закриває половину й без того маленького екрана
  if (hidden || typing) return null
  return isSeller ? <SellerNav /> : <BuyerNav />
}

// Поля, для яких телефон відкриває клавіатуру (не галочки, не кнопки, не повзунки й не вибір файлу)
const TEXT_FIELD =
  'input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]):not([type=button]):not([type=submit]), textarea, [contenteditable="true"]'

/** Чи друкує людина зараз у текстовому полі (тобто відкрита клавіатура на телефоні). */
function useTyping() {
  const [typing, setTyping] = useState(false)
  useEffect(() => {
    const isField = (el: Element | null) => el instanceof HTMLElement && el.matches(TEXT_FIELD)
    const onIn = (e: FocusEvent) => setTyping(isField(e.target as Element))
    // Фокус міг перейти в інше поле — перевіряємо вже після переходу
    const onOut = () => setTimeout(() => setTyping(isField(document.activeElement)), 0)
    document.addEventListener('focusin', onIn)
    document.addEventListener('focusout', onOut)
    return () => {
      document.removeEventListener('focusin', onIn)
      document.removeEventListener('focusout', onOut)
    }
  }, [])
  return typing
}

const ICON = { size: 22, strokeWidth: 2.2, 'aria-hidden': true } as const

function Bar({ children, cols, label, above }: { children: ReactNode; cols: number; label: string; above?: ReactNode }) {
  return (
    <nav
      aria-label={label}
      className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-sand-200 bg-sand-50/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
    >
      {above}
      <div className="grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {children}
      </div>
    </nav>
  )
}

const itemClass = (active: boolean) =>
  `flex min-h-16 flex-col items-center justify-center gap-0.5 text-[11px] font-bold transition-colors ${active ? 'text-brand-600' : 'text-sand-700'}`

/** Пункт меню. `match` — підсвічувати на всіх адресах, що так починаються (напр. будь-яка категорія /c/…). */
function Item({ to, icon, label, end, match, badge = 0 }: { to: string; icon: ReactNode; label: string; end?: boolean; match?: (path: string) => boolean; badge?: number }) {
  const { pathname } = useLocation()
  return (
    <NavLink to={to} end={end} className={({ isActive }) => itemClass(match ? match(pathname) : isActive)}>
      <span className="relative">
        {icon}
        {badge > 0 && (
          <span
            key={badge}
            className="absolute -top-1.5 left-1/2 ml-1.5 inline-flex min-w-5 animate-pop justify-center rounded-full bg-sunset-600 px-1 text-[11px] leading-5 font-extrabold text-sand-50"
          >
            {badge}
          </span>
        )}
      </span>
      {label}
    </NavLink>
  )
}

function BuyerNav() {
  const { t } = useTranslation()
  const count = useCart(selectCount)
  const user = useAuth((s) => s.user)
  return (
    <Bar cols={5} label={t('nav.bottom')}>
      <Item to="/" end icon={<Home {...ICON} />} label={t('nav.home')} />
      <Item to="/c/plants" match={(p) => p.startsWith('/c/')} icon={<LayoutGrid {...ICON} />} label={t('nav.catalog')} />
      <Item to={searchHref()} match={(p) => p.startsWith('/search')} icon={<Search {...ICON} />} label={t('nav.search')} />
      <Item to="/cart" icon={<ShoppingBag {...ICON} />} label={t('nav.cart')} badge={count} />
      {user ? (
        <Item to="/account" match={(p) => p.startsWith('/account')} icon={<User {...ICON} />} label={t('nav.account')} />
      ) : (
        <Item to="/login" icon={<LogIn {...ICON} />} label={t('nav.login')} />
      )}
    </Bar>
  )
}

// Продавцю під «Ще» — решта розділів магазину й адмінки
const MORE: { to: string; label: string; Icon: LucideIcon }[] = [
  { to: '/c/plants', label: 'nav.catalog', Icon: LayoutGrid },
  { to: '/search', label: 'nav.search', Icon: Search },
  { to: '/admin/categories', label: 'admin.categories', Icon: Tags },
  { to: '/admin/customers', label: 'admin.customers.title', Icon: Users },
  { to: '/admin/import', label: 'admin.importFromSheet', Icon: FileSpreadsheet },
  { to: '/admin/forms', label: 'admin.formFixes.title', Icon: Sparkles },
]

function SellerNav() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const { data: orders } = useOrders()
  const newCount = orders?.filter((o) => o.status === 'new').length ?? 0
  // «Ще» відкрите лише на тій сторінці, де його відкрили: перейшли деінде — закрилось само
  const [openOn, setOpenOn] = useState<string | null>(null)
  const moreOpen = openOn === pathname
  const moreActive = MORE.some((m) => pathname.startsWith(m.to === '/c/plants' ? '/c/' : m.to))

  const sheet = moreOpen && (
    <div className="absolute inset-x-3 bottom-full mb-2 animate-rise rounded-3xl border-2 border-sand-200 bg-sand-50 p-2 shadow-[0_-12px_30px_-12px_rgba(43,33,24,0.3)]">
      {MORE.map(({ to, label, Icon }) => (
        <NavLink
          key={to}
          to={to === '/search' ? searchHref() : to}
          className={({ isActive }) => `flex min-h-12 items-center gap-3 rounded-2xl px-4 font-bold ${isActive ? 'bg-brand-600 text-sand-50' : 'text-ink hover:bg-sand-200'}`}
        >
          <Icon size={20} strokeWidth={2.25} aria-hidden />
          {t(label)}
        </NavLink>
      ))}
    </div>
  )

  return (
    <Bar cols={5} label={t('admin.menu')} above={sheet}>
      {/* «Магазин» — швидкий перехід із адмінки на вітрину; підсвічений на будь-якій сторінці магазину */}
      <Item to="/" end icon={<Store {...ICON} />} label={t('nav.shop')} match={(p) => !p.startsWith('/admin') && !p.startsWith('/c/') && !p.startsWith('/search')} />
      <Item to="/admin/products" icon={<Package {...ICON} />} label={t('admin.products')} />
      <Item to="/admin/orders" icon={<ClipboardList {...ICON} />} label={t('admin.orders')} badge={newCount} />
      <Item to="/admin/analytics" icon={<BarChart3 {...ICON} />} label={t('analytics.title')} />
      <button type="button" onClick={() => setOpenOn(moreOpen ? null : pathname)} aria-expanded={moreOpen} className={itemClass(moreActive || moreOpen)}>
        {moreOpen ? <X {...ICON} /> : <MoreHorizontal {...ICON} />}
        {t('admin.more')}
      </button>
    </Bar>
  )
}
