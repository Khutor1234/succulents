import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useLang } from '../../i18n'
import { formatPrice, pick } from '../../lib/format'
import { MIN_ORDER } from '../../lib/shop'
import { ProductImage } from '../../shared/ui'
import { selectTotal, useCart } from './cartStore'
import { useCartToast } from './toastStore'

/** Спливне повідомлення «Додано в кошик» у правому нижньому куті (на телефоні — знизу на всю ширину). */
export function CartToast() {
  const { t } = useTranslation()
  const lang = useLang()
  const { toast, hide } = useCartToast()
  const qty = useCart((s) => s.items.find((i) => i.productId === toast?.productId)?.qty ?? 0)
  const remove = useCart((s) => s.remove)
  const cartTotal = useCart(selectTotal)

  if (!toast) return null
  const name = pick(toast.name, lang)

  return (
    <div
      key={toast.key}
      role="status"
      aria-live="polite"
      className="fixed inset-x-3 bottom-[calc(var(--bottom-nav-h,env(safe-area-inset-bottom))+0.75rem)] md:bottom-6 z-50 animate-toast-in overflow-hidden rounded-3xl bg-ink text-sand-100 shadow-2xl sm:inset-x-auto sm:right-6 sm:w-96"
    >
      <div className="flex items-center gap-3 p-3">
        <div className="w-14 shrink-0">
          <ProductImage src={toast.image} alt="" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold tracking-wider text-sand-300 uppercase">{t('cart.added')}</p>
          <p className="truncate font-bold text-sand-50">{name}</p>
          <p className="text-sm">{qty > 0 ? t('cart.inCart', { count: qty }) : t('cart.removed')}</p>
          {/* Скільки ще до мінімального замовлення — щоб людина одразу бачила, чи можна оформлювати */}
          {cartTotal < MIN_ORDER && (
            <p className="mt-0.5 text-xs text-sunset-500">
              {t('cart.minOrderLeft', { amount: formatPrice(MIN_ORDER - cartTotal, lang) })}
            </p>
          )}
        </div>
        <button
          onClick={hide}
          aria-label={t('cart.closeToast')}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl hover:bg-white/10"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      <div className="flex gap-2 px-3 pb-3">
        {qty > 0 && (
          <button
            onClick={() => {
              remove(toast.productId)
              hide()
            }}
            className="min-h-11 flex-1 rounded-xl bg-white/10 px-3 font-bold hover:bg-white/20"
          >
            {t('cart.remove')}
          </button>
        )}
        <Link
          to="/cart"
          onClick={hide}
          className="flex min-h-11 flex-1 items-center justify-center rounded-xl bg-brand-500 px-3 font-bold text-sand-50 hover:bg-brand-600"
        >
          {t('cart.goToCart')}
        </Link>
      </div>
      {/* Смужка, що показує, скільки ще висітиме повідомлення */}
      <div className="h-1 origin-left animate-toast-bar bg-sunset-500" />
    </div>
  )
}
