import { ArrowRight, Gift } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ICON } from '../../shared/icon'
import { BONUS_RATE } from '../account/api'
import { useAuth } from '../auth/authStore'
import { Link } from 'react-router'
import { useLang } from '../../i18n'
import { formatPrice, pick } from '../../lib/format'
import { MIN_ORDER } from '../../lib/shop'
import { PageTitle, ProductImage } from '../../shared/ui'
import { CartChanges } from './CartChanges'
import { selectTotal, useCart } from './cartStore'
import { useCartSync } from './useCartSync'

export function CartPage() {
  const { t } = useTranslation()
  const lang = useLang()
  const { items, setQty, remove } = useCart()
  const total = useCart(selectTotal)
  // Звіряємо кошик із магазином: ціни, наявність, приховані товари
  useCartSync()
  const belowMin = total < MIN_ORDER

  if (items.length === 0) {
    return (
      <div>
        <PageTitle>{t('cart.title')}</PageTitle>
        <CartChanges />
        <p className="text-sand-700">{t('cart.empty')}</p>
        <Link to="/" className="mt-6 inline-block rounded-xl bg-brand-600 px-6 py-3.5 font-bold text-sand-50">
          {t('home.toCatalog')}
        </Link>
      </div>
    )
  }

  const step =
    'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg font-bold leading-none hover:bg-sand-200 disabled:opacity-30'

  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle>{t('cart.title')}</PageTitle>
      <CartChanges />
      <ul className="divide-y-2 divide-sand-200 rounded-3xl border-2 border-sand-200 bg-sand-50">
        {items.map((item) => {
          const name = pick(item.name, lang)
          return (
            // Сітка: фото зліва на всю висоту, праворуч назва й ціна, під ними лічильник і сума —
            // так рядок не «розлазиться» на вузьких екранах (iPhone ≈ 390px).
            <li key={item.productId} className="grid grid-cols-[72px_minmax(0,1fr)] gap-x-3 gap-y-2 p-3 sm:grid-cols-[88px_minmax(0,1fr)] sm:p-4">
              <Link to={`/product/${item.slug}`} className="row-span-2 self-start">
                <ProductImage src={item.image} alt={name} />
              </Link>

              <div className="flex min-w-0 items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link to={`/product/${item.slug}`} className="line-clamp-2 leading-snug font-bold hover:text-brand-600">
                    {name}
                  </Link>
                  <p className="mt-0.5 text-sm text-sand-700">{t('cart.perItem', { price: formatPrice(item.price, lang) })}</p>
                </div>
                <button
                  onClick={() => remove(item.productId)}
                  aria-label={`${t('cart.remove')}: ${name}`}
                  title={t('cart.remove')}
                  className="-mt-1 -mr-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-red-700 hover:bg-red-50"
                >
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
                  </svg>
                </button>
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center rounded-xl border-2 border-sand-200 bg-sand-50" role="group" aria-label={t('cart.quantity')}>
                  <button className={step} onClick={() => setQty(item.productId, item.qty - 1)} disabled={item.qty <= 1} aria-label={t('cart.decrease')}>
                    −
                  </button>
                  <span className="w-8 text-center font-bold tabular-nums" aria-live="polite">
                    {item.qty}
                  </span>
                  <button className={step} onClick={() => setQty(item.productId, item.qty + 1)} disabled={item.qty >= item.maxQty} aria-label={t('cart.increase')}>
                    +
                  </button>
                </div>
                <span className="font-display text-lg font-extrabold whitespace-nowrap text-sunset-600">
                  {formatPrice(item.price * item.qty, lang)}
                </span>
              </div>
            </li>
          )
        })}
      </ul>
      <div className="mt-6 rounded-3xl bg-brand-600 px-5 py-5 text-sand-50 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-lg">
            {t('cart.total')}: <strong className="font-display text-2xl font-extrabold">{formatPrice(total, lang)}</strong>
          </p>
          {belowMin ? (
            // Нижче мінімуму оформити не можна — кнопка неактивна, пояснення під нею
            <span
              aria-disabled="true"
              className="w-full cursor-not-allowed rounded-xl bg-brand-700 px-6 py-3.5 text-center font-bold text-sand-300 sm:w-auto"
            >
              {t('cart.checkout')}
            </span>
          ) : (
            <Link to="/checkout" className="w-full rounded-xl bg-sand-50 px-6 py-3.5 text-center font-bold text-ink hover:bg-sand-100 sm:w-auto">
              {t('cart.checkout')}
            </Link>
          )}
        </div>
        <MinOrderProgress subtotal={total} className="mt-4" />
      </div>
      <BonusHint subtotal={total} />
    </div>
  )
}

/**
 * Шкала до мінімального замовлення (1000 грн): «Додайте ще 350 грн, щоб оформити».
 * Коли сума досягнута — коротке «Мінімальну суму досягнуто». Використовується в кошику й у спливному повідомленні.
 */
export function MinOrderProgress({ subtotal, className = '', tone = 'dark' }: { subtotal: number; className?: string; tone?: 'dark' | 'light' }) {
  const { t } = useTranslation()
  const lang = useLang()
  const percent = Math.min(100, Math.round((subtotal / MIN_ORDER) * 100))
  const left = MIN_ORDER - subtotal
  const dark = tone === 'dark'
  return (
    <div className={className}>
      <p className={`text-sm ${dark ? 'text-sand-100' : 'text-ink'}`}>
        {left > 0 ? (
          <>
            {t('cart.minOrderLeft', { amount: formatPrice(left, lang) })}{' '}
            <span className={dark ? 'text-sand-300' : 'text-sand-700'}>{t('cart.minOrderNote', { amount: formatPrice(MIN_ORDER, lang) })}</span>
          </>
        ) : (
          t('cart.minOrderReached')
        )}
      </p>
      <div
        className={`mt-2 h-2.5 overflow-hidden rounded-full ${dark ? 'bg-brand-700' : 'bg-sand-200'}`}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={t('cart.minOrderProgress')}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-500 ease-out ${left > 0 ? 'bg-sunset-500' : 'bg-sand-50'}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}

/**
 * Скільки бонусів покупець отримає з цього кошика (10% від суми).
 * Точна сума — після оформлення: якщо списати бонуси, 10% рахуються від суми, що лишилась до сплати.
 */
function BonusHint({ subtotal }: { subtotal: number }) {
  const { t } = useTranslation()
  const lang = useLang()
  const user = useAuth((s) => s.user)
  const earn = formatPrice(Math.floor(subtotal * BONUS_RATE), lang)

  return (
    <Link
      to={user ? '/account' : '/login?mode=signup'}
      className="group mt-3 flex items-center gap-3 rounded-2xl border-2 border-dashed border-sunset-500 bg-sand-50 px-4 py-3 transition-colors hover:bg-sand-200"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sunset-600 text-sand-50">
        <Gift {...ICON} />
      </span>
      <span className="flex-1 text-sm">
        {user ? (
          <>
            <strong>{t('cart.willEarn', { amount: earn })}</strong>
            <span className="block text-sand-700">{t('cart.willEarnHint')}</span>
          </>
        ) : (
          <strong>{t('bonus.guestHint', { amount: earn })}</strong>
        )}
      </span>
      <ArrowRight {...ICON} className="shrink-0 text-sunset-600 transition-transform group-hover:translate-x-1" />
    </Link>
  )
}
