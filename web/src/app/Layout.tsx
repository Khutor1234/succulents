import { signOut } from 'firebase/auth'
import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, NavLink, Outlet, ScrollRestoration, useLocation } from 'react-router'
import { AccountBanner } from '../features/auth/AccountBanner'
import { useAuth } from '../features/auth/authStore'
import { CartToast } from '../features/cart/CartToast'
import { useFavorites, useFavoritesSync } from '../features/favorites/favoritesStore'
import { selectCount, useCart } from '../features/cart/cartStore'
import { useBonusBalance } from '../features/account/api'
import { auth } from '../firebase/config'
import { formatPrice } from '../lib/format'
import { ICON } from '../shared/icon'
import { searchHref } from '../shared/navigation'
import { BookOpen, ChevronRight, Construction, Heart, Home, LayoutGrid, LogIn, LogOut, Menu, Package, Search, ShieldCheck, ShoppingBag, User, X } from 'lucide-react'

const YEAR = new Date().getFullYear()
/** Плашка «у розробці» над шапкою. Прибрати — VITE_UNDER_CONSTRUCTION=false у web/.env.production і опублікувати. */
const UNDER_CONSTRUCTION = import.meta.env.VITE_UNDER_CONSTRUCTION === 'true'
// Без display: кожна кнопка сама каже, коли її видно (inline-flex — завжди, hidden md:inline-flex — лише на комп’ютері)
const NAV_BTN = 'min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-xl px-3 font-medium transition-colors'

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

/** Меню на телефоні: великі кнопки на всі розділи, вхід і вихід. */
function MobileMenu({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const { user, role } = useAuth()
  const { balance } = useBonusBalance()
  const favorites = useFavorites((s) => s.ids.length)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const item = (to: string, icon: ReactNode, label: string, extra?: ReactNode) => (
    <Link
      to={to}
      onClick={onClose}
      className="flex min-h-13 items-center gap-3 rounded-2xl px-3 py-2.5 font-bold transition-colors hover:bg-sand-200 active:bg-sand-200"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-600">{icon}</span>
      <span className="flex-1">{label}</span>
      {extra}
      <ChevronRight size={18} strokeWidth={2.25} className="text-sand-700" aria-hidden />
    </Link>
  )
  const badge = (text: string | number) => <span className="rounded-full bg-sunset-100 px-2.5 py-0.5 text-sm font-bold text-sunset-700">{text}</span>

  return (
    <nav id="mobile-menu" aria-label={t('nav.menu')} className="absolute inset-x-0 top-full max-h-[calc(100dvh-var(--header-h,0px))] animate-menu-in overflow-y-auto border-b border-sand-200 bg-sand-100 px-4 pt-2 pb-4 shadow-[0_18px_30px_-18px_rgba(43,33,24,0.35)] md:hidden">
      <div className="mx-auto max-w-6xl space-y-1">
        {item('/c/plants', <LayoutGrid {...ICON} />, t('nav.catalog'))}
        {item('/blog', <BookOpen {...ICON} />, t('blog.title'))}
        {/* Кабінет, улюблене й замовлення — для покупця; у продавця замість них адмінка */}
        {user && role !== 'seller' && (
          <>
            {item('/account', <User {...ICON} />, t('account.nav'), balance > 0 ? badge(formatPrice(balance, 'uk')) : null)}
            {item('/account/favorites', <Heart {...ICON} />, t('favorites.title'), favorites > 0 ? badge(favorites) : null)}
            {item('/account/orders', <Package {...ICON} />, t('account.orders'))}
          </>
        )}
        {role === 'seller' && item('/admin', <ShieldCheck {...ICON} />, t('nav.admin'))}
        <div className="pt-2">
          {user ? (
            <button
              type="button"
              onClick={() => {
                onClose()
                void signOut(auth)
              }}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-red-700 font-bold text-red-700 hover:bg-red-100"
            >
              <LogOut {...ICON} />
              {t('nav.logout')}
            </button>
          ) : (
            <Link to="/login" onClick={onClose} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 font-bold text-sand-50 hover:bg-brand-700">
              <LogIn {...ICON} />
              {t('nav.login')}
            </Link>
          )}
        </div>
      </div>
    </nav>
  )
}

/**
 * Нижнє меню на телефоні — як у застосунках: найпотрібніше завжди під пальцем.
 * Покупцю: головна, каталог, пошук, кошик, кабінет (або «Увійти»). Продавцю замість кошика й кабінету — адмінка.
 * В адмінці не показуємо: там своє нижнє меню (AdminLayout).
 */
function ShopBottomNav() {
  const { t } = useTranslation()
  const count = useCart(selectCount)
  const { user, role } = useAuth()
  const { pathname } = useLocation()
  const hidden = pathname.startsWith('/admin')

  // Місце під меню внизу сторінки (див. index.css)
  useEffect(() => {
    if (hidden) return
    document.documentElement.classList.add('shop-bottom-nav')
    return () => document.documentElement.classList.remove('shop-bottom-nav')
  }, [hidden])
  if (hidden) return null

  const isSeller = role === 'seller'
  return (
    <nav
      aria-label={t('nav.bottom')}
      className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-sand-200 bg-sand-50/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
    >
      <div className={`grid ${isSeller ? 'grid-cols-4' : 'grid-cols-5'}`}>
        <BottomItem to="/" end icon={<Home size={22} strokeWidth={2.2} aria-hidden />} label={t('nav.home')} />
        <BottomItem to="/c/plants" match="/c/" icon={<LayoutGrid size={22} strokeWidth={2.2} aria-hidden />} label={t('nav.catalog')} />
        <BottomItem to={searchHref()} match="/search" icon={<Search size={22} strokeWidth={2.2} aria-hidden />} label={t('nav.search')} />
        {isSeller ? (
          <BottomItem to="/admin" icon={<ShieldCheck size={22} strokeWidth={2.2} aria-hidden />} label={t('nav.admin')} />
        ) : (
          <>
            <BottomItem
              to="/cart"
              icon={
                <span className="relative">
                  <ShoppingBag size={22} strokeWidth={2.2} aria-hidden />
                  {count > 0 && (
                    <span
                      key={count}
                      className="absolute -top-1.5 left-1/2 ml-1.5 inline-flex min-w-5 animate-pop justify-center rounded-full bg-brand-600 px-1 text-[11px] leading-5 font-extrabold text-sand-50"
                    >
                      {count}
                    </span>
                  )}
                </span>
              }
              label={t('nav.cart')}
            />
            <BottomItem
              to={user ? '/account' : '/login'}
              match={user ? '/account' : '/login'}
              icon={user ? <User size={22} strokeWidth={2.2} aria-hidden /> : <LogIn size={22} strokeWidth={2.2} aria-hidden />}
              label={user ? t('nav.account') : t('nav.login')}
            />
          </>
        )}
      </div>
    </nav>
  )
}

function BottomItem({ to, icon, label, end, match }: { to: string; icon: ReactNode; label: string; end?: boolean; match?: string }) {
  const { pathname } = useLocation()
  // «Каталог» підсвічуємо на будь-якій категорії (/c/soil тощо), не лише на /c/plants
  const forced = match ? pathname.startsWith(match) : undefined
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex min-h-16 flex-col items-center justify-center gap-0.5 text-[11px] font-bold transition-colors ${
          (forced ?? isActive) ? 'text-brand-600' : 'text-sand-700'
        }`
      }
    >
      {icon}
      {label}
    </NavLink>
  )
}

export function Layout() {
  const { t } = useTranslation()
  const count = useCart(selectCount)
  const { user, role } = useAuth()
  const { balance } = useBonusBalance()
  const { pathname } = useLocation()
  useFavoritesSync()
  // Меню на телефоні; закривається при переході на іншу сторінку
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPath, setMenuPath] = useState(pathname)
  if (menuPath !== pathname) {
    setMenuPath(pathname)
    setMenuOpen(false)
  }
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
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:gap-x-7">
          <Link to="/" className="text-2xl text-brand-600">
            <Logo />
          </Link>
          {/* На телефоні в шапці лише кнопка меню: пошук, кошик, кабінет і адмінка — у нижньому меню. На комп’ютері — усі кнопки в шапці. */}
          <div className="ml-auto flex items-center gap-1.5 text-sm sm:gap-2">
            <Link to={searchHref()} aria-label={t('search.open')} title={t('search.open')} className={NAV_BTN + ' hidden hover:bg-sand-200 md:inline-flex'}>
              <Search {...ICON} />
            </Link>
            <Link to="/blog" aria-label={t('blog.title')} title={t('blog.title')} className={NAV_BTN + ' hidden hover:bg-sand-200 md:inline-flex'}>
              <BookOpen {...ICON} />
              <span>{t('blog.title')}</span>
            </Link>
            {role === 'seller' && (
              // Продавцю кошик і кабінет у шапці не потрібні — на їхньому місці адмінка, і на телефоні теж
              <Link to="/admin" aria-label={t('nav.admin')} className={NAV_BTN + ' hidden bg-sand-200 font-bold hover:bg-sand-300 md:inline-flex'}>
                <ShieldCheck {...ICON} />
                <span className="hidden sm:inline">{t('nav.admin')}</span>
              </Link>
            )}
            {user && role !== 'seller' && (
              <Link to="/account" aria-label={t('account.nav')} className={NAV_BTN + ' hidden bg-sand-200 hover:bg-sand-300 md:inline-flex'}>
                <User {...ICON} />
                <span className="hidden md:inline">{t('account.nav')}</span>
                {balance > 0 && <span className="font-bold text-sunset-600">{formatPrice(balance, 'uk')}</span>}
              </Link>
            )}
            {role !== 'seller' && (
            <Link to="/cart" aria-label={t('nav.cart')} className={`group ${NAV_BTN} hidden bg-sand-200 font-bold hover:bg-sand-300 md:inline-flex`}>
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
            )}
            {/* Вхід і вихід — завжди найправіші: зелений «Увійти», червоний «Вийти» */}
            {user ? (
              <button
                onClick={() => void signOut(auth)}
                aria-label={t('nav.logout')}
                className={NAV_BTN + ' hidden bg-red-700 font-bold text-white hover:bg-red-800 md:inline-flex'}
              >
                <LogOut {...ICON} />
                <span>{t('nav.logout')}</span>
              </button>
            ) : (
              <Link to="/login" className={NAV_BTN + ' hidden bg-brand-600 font-bold text-sand-50 hover:bg-brand-700 md:inline-flex'}>
                <LogIn {...ICON} />
                {t('nav.login')}
              </Link>
            )}
            {/* Кнопка меню — лише на телефоні */}
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              aria-label={t(menuOpen ? 'nav.closeMenu' : 'nav.menu')}
              className={NAV_BTN + ' relative inline-flex bg-brand-600 text-sand-50 hover:bg-brand-700 md:hidden'}
            >
              {menuOpen ? <X {...ICON} /> : <Menu {...ICON} />}
              {/* Крапка-нагадування: у меню є бонуси */}
              {!menuOpen && balance > 0 && <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full border-2 border-brand-600 bg-sunset-500" aria-hidden />}
            </button>
          </div>
        </div>
        {menuOpen && <MobileMenu onClose={() => setMenuOpen(false)} />}
      </header>
      {/* Затемнення під меню: натиснули поза меню — закрилось */}
      {menuOpen && <div className="fixed inset-0 z-30 animate-page-in bg-ink/30 md:hidden" onClick={() => setMenuOpen(false)} aria-hidden />}
      <div aria-hidden="true" style={{ height: headerHeight }} />
      <AccountBanner />
      {/* key — щоб анімація появи спрацьовувала на кожному переході між сторінками */}
      <main key={pathname} className="mx-auto w-full max-w-6xl flex-1 animate-page-in px-4 pt-6 pb-16">
        <Outlet />
      </main>
      <CartToast />
      <ShopBottomNav />
      {/* Нова сторінка відкривається зверху; «Назад» повертає туди, де людина була */}
      <ScrollRestoration />
      <footer className="bg-ink text-sand-300">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-9 text-sm">
          <Logo className="text-xl text-sand-100" bg="fill-ink" />
          <span>{t('footer.delivery')}</span>
          <Link to="/blog" className="font-bold text-sand-100 hover:underline">
            {t('blog.title')}
          </Link>
          <span className="ml-auto">© {YEAR}</span>
        </div>
      </footer>
    </div>
  )
}
