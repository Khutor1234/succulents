import { signOut } from 'firebase/auth'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Outlet, useLocation } from 'react-router'
import { AccountBanner } from '../features/auth/AccountBanner'
import { useAuth } from '../features/auth/authStore'
import { CartToast } from '../features/cart/CartToast'
import { useFavoritesSync } from '../features/favorites/favoritesStore'
import { selectCount, useCart } from '../features/cart/cartStore'
import { useBonusBalance } from '../features/account/api'
import { auth } from '../firebase/config'
import { formatPrice } from '../lib/format'
import { ICON } from '../shared/icon'
import { Construction, LogIn, LogOut, Search, ShieldCheck, ShoppingBag, User } from 'lucide-react'

const YEAR = new Date().getFullYear()
/** Плашка «у розробці» над шапкою. Прибрати — VITE_UNDER_CONSTRUCTION=false у web/.env.production і опублікувати. */
const UNDER_CONSTRUCTION = import.meta.env.VITE_UNDER_CONSTRUCTION === 'true'
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

/**
 * Мінімалістична ехеверія згори — лише тонкі лінії: вісім зовнішніх листків, п'ять внутрішніх і серединка.
 * Внутрішні листки зафарбовані кольором фону (`bg`), щоб перекривати лінії зовнішніх — без зайвих перетинів.
 */
function EcheveriaIcon({ className = '', bg = 'fill-sand-100' }: { className?: string; bg?: string }) {
  const leaf = (length: number, width: number) =>
    `M0 0C${-width} ${-length * 0.35} ${-width * 0.75} ${-length * 0.8} 0 ${-length}C${width * 0.75} ${-length * 0.8} ${width} ${-length * 0.35} 0 0Z`
  return (
    <svg viewBox="0 0 32 32" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true" className={className}>
      <g transform="translate(16 16)" className={bg}>
        {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
          <path key={a} d={leaf(14, 5.5)} transform={`rotate(${a + 22.5})`} />
        ))}
        {[0, 72, 144, 216, 288].map((a) => (
          <path key={a} d={leaf(9, 4.5)} transform={`rotate(${a})`} />
        ))}
        <circle r="1.4" fill="currentColor" stroke="none" />
      </g>
    </svg>
  )
}

function Logo({ className = '', bg }: { className?: string; bg?: string }) {
  const { t } = useTranslation()
  return (
    <span className={`inline-flex items-center gap-1.5 font-display font-extrabold lowercase ${className}`}>
      <span>
        {t('brand')}
        <span className="text-sunset-500">.</span>
      </span>
      <EcheveriaIcon bg={bg} className="h-[1.2em] w-[1.2em] shrink-0" />
    </span>
  )
}

export function Layout() {
  const { t } = useTranslation()
  const count = useCart(selectCount)
  const { user, role } = useAuth()
  const { balance } = useBonusBalance()
  const { pathname } = useLocation()
  useFavoritesSync()
  // У шапці лише логотип і кнопки — категорії є великими кнопками на головній і в каталозі.
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
        {/* Плашка «магазин у розробці» — частина шапки, тож видна завжди. Вмикається VITE_UNDER_CONSTRUCTION=true. */}
        {UNDER_CONSTRUCTION && (
          <div role="status" className="bg-sunset-600 text-sand-50">
            <p className="mx-auto flex max-w-6xl items-center justify-center gap-2 px-4 py-1.5 text-center text-xs font-bold sm:text-sm">
              <Construction size={16} strokeWidth={2.25} className="shrink-0" aria-hidden />
              <span className="sm:hidden">{t('underConstructionShort')}</span>
              <span className="hidden sm:inline">{t('underConstruction')}</span>
            </p>
          </div>
        )}
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-7 gap-y-2 px-4 py-3">
          <Link to="/" className="text-2xl text-brand-600">
            <Logo />
          </Link>
          {/* На телефоні лише іконки (підписи ховаються, але лишаються для екранних читалок) */}
          <div className="ml-auto flex items-center gap-1.5 text-sm sm:gap-2">
            <Link to="/search" aria-label={t('search.open')} title={t('search.open')} className={NAV_BTN + ' hover:bg-sand-200'}>
              <Search {...ICON} />
            </Link>
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
          <Logo className="text-xl text-sand-100" bg="fill-ink" />
          <span>{t('footer.delivery')}</span>
          <span className="ml-auto">© {YEAR}</span>
        </div>
      </footer>
    </div>
  )
}
