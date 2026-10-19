import { Heart } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLang } from '../../i18n'
import { pick } from '../../lib/format'
import type { Product } from '../../lib/types'
import { useAuth } from '../auth/authStore'
import { useFavorites } from './favoritesStore'

/**
 * Сердечко «в улюблене».
 * - `overlay` — кругла кнопка поверх фото на картці;
 * - `lg` — кнопка з підписом на сторінці товару.
 */
export function FavoriteButton({ product, variant = 'overlay', className = '' }: { product: Product; variant?: 'overlay' | 'lg'; className?: string }) {
  const { t } = useTranslation()
  const lang = useLang()
  const on = useFavorites((s) => s.ids.includes(product.id))
  const toggle = useFavorites((s) => s.toggle)
  const name = pick(product.name, lang)
  // Скільки разів рослину лайкнули. Своє натискання враховуємо одразу (сервер оновить число трохи згодом)
  const [onAtLoad] = useState(on)
  // Кількість лайків — лише для продавця (покупцям — просто сердечко)
  const isSeller = useAuth((s) => s.role === 'seller')
  const likes = isSeller ? Math.max(0, (product.likes ?? 0) + Number(on) - Number(onAtLoad)) : 0

  const icon = (
    <Heart
      size={variant === 'lg' ? 20 : 18}
      strokeWidth={2.25}
      fill={on ? 'currentColor' : 'none'}
      aria-hidden
      // key: при додаванні сердечко «підстрибує»
      key={String(on)}
      className={on ? 'animate-pop' : ''}
    />
  )

  if (variant === 'lg') {
    return (
      <button
        type="button"
        onClick={() => toggle(product.id)}
        aria-pressed={on}
        className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 px-5 font-bold transition-colors active:scale-[0.97] ${
          on ? 'border-sunset-500 bg-sunset-100 text-sunset-700' : 'border-sand-300 text-ink hover:border-sunset-500 hover:text-sunset-700'
        } ${className}`}
      >
        {icon}
        {t(on ? 'favorites.inFavorites' : 'favorites.add')}
        {likes > 0 && <span className="tabular-nums opacity-70">· {likes}</span>}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        // Кнопка лежить на фото-посиланні — не відкриваємо товар
        e.preventDefault()
        e.stopPropagation()
        toggle(product.id)
      }}
      aria-pressed={on}
      aria-label={t(on ? 'favorites.removeNamed' : 'favorites.addNamed', { name })}
      title={t(on ? 'favorites.inFavorites' : 'favorites.add')}
      className={`flex h-10 min-w-10 items-center justify-center gap-1 rounded-full bg-sand-50/90 shadow-sm backdrop-blur transition-transform hover:scale-110 active:scale-95 ${likes > 0 ? 'px-2.5' : ''} ${
        on ? 'text-sunset-600' : 'text-ink'
      } ${className}`}
    >
      {icon}
      {likes > 0 && <span className="text-sm font-extrabold tabular-nums">{likes}</span>}
    </button>
  )
}
