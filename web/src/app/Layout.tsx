import { signOut } from 'firebase/auth'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { AccountBanner } from '../features/auth/AccountBanner'
import { useAuth } from '../features/auth/authStore'
import { CartToast } from '../features/cart/CartToast'
import { selectCount, useCart } from '../features/cart/cartStore'
import { useBonusBalance } from '../features/account/api'
import { useCategories } from '../features/catalog/categories'
import { auth } from '../firebase/config'
import { formatPrice } from '../lib/format'
import { ICON } from '../shared/icon'
import { LogIn, LogOut, ShieldCheck, ShoppingBag, User } from 'lucide-react'

const YEAR = new Date().getFullYear()
const NAV_BTN = 'inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-xl px-3 font-medium transition-colors'

/**
 * Поточна висота елемента (оновлюється при зміні розміру: поворот телефона, другий рядок шапки тощо).
 * Ще й записує її в CSS-змінну --header-h — для відступу прокрутки до якорів.
 */
function useElementHeight<T extends HTMLElement>() {
  const [el, setEl] = useState<T | null>(null)
  const [height, setHeight] = useState(0)
  useEffect(() => {
    if (!el) return
    const observer = new ResizeObserver(() => {
      const h = el.getBoundingClientRect().height
      setHeight(h)
      document.documentElement.style.setProperty('--header-h', `${h}px`)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [el])
  return [setEl, height] as const
}

function Logo({ className = '' }: { className?: string }) {
  const { t } = useTranslation()
  return (
    <span className={`font-display font-extrabold lowercase ${className}`}>
      {t('brand')}
      <span className="text-sunset-500">.</span>
    </span>
  )
}

export function Layout() {
  const { t } = useTranslation()
  const count = useCart(selectCount)
  const { user, role } = useAuth()
  const { visible: categories, nameOf } = useCategories()
  const { balance } = useBonusBalance()
  const { pathname } = useLocation()
  const hasCategoryPills = pathname === '/' || pathname.startsWith('/c/')
  const [headerRef, headerHeight] = useElementHeight<HTMLElement>()

  return (
    <div className="flex min-h-screen flex-col">
      {/* Шапка закріплена (fixed) до самого верху екрана з суцільним фоном. Не sticky: Safari на iPhone фарбує
          смужку з годинником кольором саме fixed-шапки — тоді над нею не видно сторінки, що прокручується.
          Місце під шапкою тримає розпірка нижче (висоту міряємо, бо шапка буває у два рядки). */}
      <header
        ref={headerRef}
        className="fixed inset-x-0 top-0 z-40 border-b border-sand-200 bg-sand-100 pt-[env(safe-area-inset-top)] shadow-[0_1px_0_rgb(0_0_0/0.02)]"
      >
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-7 gap-y-2 px-4 py-3">
          <Link to="/" className="text-2xl text-brand-600">
            <Logo />
          </Link>
          {/* На головній і в категоріях під шапкою вже є великі кнопки категорій — тут їх не дублюємо */}
          {!hasCategoryPills && (
          <nav className="order-last flex w-full gap-5 overflow-x-auto text-[15px] font-medium xl:order-none xl:w-auto">
            {categories.map((c) => (
              <NavLink
                key={c}
                to={`/c/${c}`}
                className={({ isActive }) =>
                  `py-1 whitespace-nowrap ${isActive ? 'text-sunset-600 underline decoration-2 underline-offset-4' : 'text-ink hover:text-brand-600'}`
                }
              >
                {nameOf(c)}
              </NavLink>
            ))}
          </nav>
          )}
          {/* На телефоні лише іконки (підписи ховаються, але лишаються для екранних читалок) */}
          <div className="ml-auto flex items-center gap-1.5 text-sm sm:gap-2">
            {role === 'seller' && (
              <Link to="/admin" aria-label={t('nav.admin')} className={NAV_BTN + ' hover:bg-sand-200'}>
                <ShieldCheck {...ICON} />
                <span className="hidden md:inline">{t('nav.admin')}</span>
              </Link>
            )}
            {user && (
              <Link to="/account" aria-label={t('account.nav')} className={NAV_BTN + ' bg-sand-200 hover:bg-sand-300'}>
                <User {...ICON} />
                <span className="hidden md:inline">{t('account.nav')}</span>
                {balance > 0 && <span className="font-bold text-sunset-600">{formatPrice(balance, 'uk')}</span>}
              </Link>
            )}
            <Link to="/cart" aria-label={t('nav.cart')} className={`group ${NAV_BTN} bg-sand-200 font-bold hover:bg-sand-300`}>
              <ShoppingBag {...ICON} className="group-hover:animate-wiggle" />
              <span className="hidden sm:inline">{t('nav.cart')}</span>
              {count > 0 && (
                // key={count}: на кожну зміну кількості лічильник «підстрибує»
                <span
                  key={count}
                  className="inline-flex min-w-5 animate-pop justify-center rounded-full bg-brand-600 px-1.5 text-xs leading-5 text-sand-50"
                >
                  {count}
                </span>
              )}
            </Link>
            {/* Вхід і вихід — завжди найправіші: зелений «Увійти», червоний «Вийти» */}
            {user ? (
              <button
                onClick={() => void signOut(auth)}
                aria-label={t('nav.logout')}
                className={NAV_BTN + ' bg-red-700 font-bold text-white hover:bg-red-800'}
              >
                <LogOut {...ICON} />
                <span className="hidden sm:inline">{t('nav.logout')}</span>
              </button>
            ) : (
              <Link to="/login" className={NAV_BTN + ' bg-brand-600 font-bold text-sand-50 hover:bg-brand-700'}>
                <LogIn {...ICON} />
                {t('nav.login')}
              </Link>
            )}
          </div>
        </div>
      </header>
      <div aria-hidden="true" style={{ height: headerHeight }} />
      <AccountBanner />
      {/* key — щоб анімація появи спрацьовувала на кожному переході між сторінками */}
      <main key={pathname} className="mx-auto w-full max-w-6xl flex-1 animate-page-in px-4 pt-6 pb-16">
        <Outlet />
      </main>
      <CartToast />
      <footer className="bg-ink text-sand-300">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-9 text-sm">
          <Logo className="text-xl text-sand-100" />
          <span>{t('footer.delivery')}</span>
          <span className="ml-auto">© {YEAR}</span>
        </div>
      </footer>
    </div>
  )
}
