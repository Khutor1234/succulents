import { Heart } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useLang } from '../../i18n'
import { pick } from '../../lib/format'
import type { Product } from '../../lib/types'
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
      className={`flex h-10 w-10 items-center justify-center rounded-full bg-sand-50/90 shadow-sm backdrop-blur transition-transform hover:scale-110 active:scale-95 ${
        on ? 'text-sunset-600' : 'text-ink'
      } ${className}`}
    >
      {icon}
    </button>
  )
}
