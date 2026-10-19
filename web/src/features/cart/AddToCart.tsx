import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Product } from '../../lib/types'
import { Minus, Plus, ShoppingBag, Trash } from 'lucide-react'
import { track } from '../../lib/monitoring'
import { ICON } from '../../shared/icon'
import { Button } from '../../shared/ui'
import { useCart } from './cartStore'
import { useCartToast } from './toastStore'

/**
 * Кнопка «У кошик». Якщо товар уже в кошику — замість неї лічильник «− 2 +» і кнопка видалення.
 * `size="lg"` — для сторінки товару.
 */
export function AddToCart({ product, size = 'md' }: { product: Product; size?: 'md' | 'lg' }) {
  const { t } = useTranslation()
  const qty = useCart((s) => s.items.find((i) => i.productId === product.id)?.qty ?? 0)
  const { add, setQty, remove } = useCart()
  const showToast = useCartToast((s) => s.show)
  // Перемикаємо ключ, щоб анімація «пружинки» запускалась на кожне натискання.
  const [bump, setBump] = useState(0)

  if (product.stock === 0) {
    return (
      <Button className={size === 'lg' ? 'px-8' : 'w-full'} disabled>
        {t('product.outOfStock')}
      </Button>
    )
  }

  function addOne() {
    add({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      price: product.price,
      image: product.images[0],
      maxQty: product.stock,
      cutting: product.tags?.includes('cutting') ?? false,
    })
    setBump((b) => b + 1)
    showToast({ productId: product.id, name: product.name, image: product.images[0] })
    track('cart_add', { productId: product.id, qty: qty + 1 })
  }

  if (qty === 0) {
    return (
      <Button className={`group ${size === 'lg' ? 'px-8' : 'w-full'}`} onClick={addOne}>
        <ShoppingBag {...ICON} className="group-hover:animate-wiggle" />
        {t('product.addToCart')}
      </Button>
    )
  }

  const step =
    'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl font-bold transition-transform hover:bg-brand-700 active:scale-90 disabled:opacity-40'

  return (
    <div className={`flex items-center gap-2 ${size === 'lg' ? '' : 'w-full'}`}>
      <div
        className={`flex flex-1 items-center justify-between rounded-xl bg-brand-600 text-sand-50 ${size === 'lg' ? 'min-w-44' : ''}`}
        role="group"
        aria-label={t('cart.quantity')}
      >
        <button className={step} onClick={() => setQty(product.id, qty - 1)} disabled={qty <= 1} aria-label={t('cart.decrease')}>
          <Minus {...ICON} />
        </button>
        <span key={bump} className="inline-block animate-pop text-center font-bold" aria-live="polite">
          {t('cart.inCartShort', { count: qty })}
        </span>
        <button className={step} onClick={addOne} disabled={qty >= product.stock} aria-label={t('cart.increase')}>
          <Plus {...ICON} />
        </button>
      </div>
      <button
        onClick={() => {
          remove(product.id)
          track('cart_remove', { productId: product.id })
        }}
        aria-label={t('cart.remove')}
        title={t('cart.remove')}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sand-200 text-red-700 transition-transform hover:bg-red-100 active:scale-90"
      >
        <Trash {...ICON} />
      </button>
    </div>
  )
}
