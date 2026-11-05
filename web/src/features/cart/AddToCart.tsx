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
 * Кнопка «У кошик». Якщо товар уже в кошику — замість неї лічильник «− 2 +». Мінус на одній штуці прибирає товар
 * з кошика (тоді замість мінуса — кошик-смітник), тож окрема кнопка видалення не потрібна.
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

  function decrease() {
    if (qty > 1) return setQty(product.id, qty - 1)
    remove(product.id)
    track('cart_remove', { productId: product.id })
  }

  const step =
    'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-700 text-xl font-bold transition-transform hover:brightness-125 active:scale-90 disabled:cursor-not-allowed disabled:bg-transparent disabled:opacity-35 disabled:active:scale-100'

  return (
    <div className={`flex items-center gap-2 ${size === 'lg' ? '' : 'w-full'}`}>
      <div
        className={`flex flex-1 items-center justify-between rounded-xl bg-brand-600 text-sand-50 ${size === 'lg' ? 'min-w-44' : ''}`}
        role="group"
        aria-label={t('cart.quantity')}
      >
        <button className={step} onClick={decrease} aria-label={qty > 1 ? t('cart.decrease') : t('cart.remove')} title={qty > 1 ? undefined : t('cart.remove')}>
          {qty > 1 ? <Minus {...ICON} /> : <Trash {...ICON} />}
        </button>
        <span key={bump} className="inline-block animate-pop text-center font-bold" aria-live="polite">
          {t('cart.inCartShort', { count: qty })}
        </span>
        <button
          className={step}
          onClick={addOne}
          disabled={qty >= product.stock}
          aria-label={qty >= product.stock ? t('cart.noMore') : t('cart.increase')}
          title={qty >= product.stock ? t('cart.noMore') : undefined}
        >
          <Plus {...ICON} />
        </button>
      </div>
    </div>
  )
}
