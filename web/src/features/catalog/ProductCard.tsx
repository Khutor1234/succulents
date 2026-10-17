import { Pencil } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useLang } from '../../i18n'
import { formatPrice, pick } from '../../lib/format'
import { PLANT_CATEGORY } from '../../lib/plants'
import type { Product } from '../../lib/types'
import { ProductImage } from '../../shared/ui'
import { useProgressive } from '../../shared/useProgressive'
import { useAuth } from '../auth/authStore'
import { AddToCart } from '../cart/AddToCart'
import { FavoriteButton } from '../favorites/FavoriteButton'
import { ParentsLinks } from './ParentsLinks'
import { TagBadges } from './PlantFilters'

// Картки по черзі отримують теплий пісочний і оливковий фон — як у макеті «Пустеля».
const TINTS = ['bg-sand-300/60', 'bg-brand-100']
// Скільки карток показуємо за раз (решта — коли догортали донизу)
const PAGE = 24

export function ProductCard({ product, index = 0 }: { product: Product; index?: number }) {
  const { t } = useTranslation()
  const lang = useLang()
  const name = pick(product.name, lang)
  const isSeller = useAuth((s) => s.role === 'seller')

  return (
    // Картки з'являються одна за одною (затримка за індексом) і легко піднімаються при наведенні
    <article
      style={{ animationDelay: `${Math.min(index % PAGE, 11) * 45}ms` }}
      className="flex animate-rise flex-col rounded-3xl border-2 border-sand-200 bg-sand-50 p-3 transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-1 hover:border-sand-300 hover:shadow-[0_12px_30px_-12px_rgba(43,33,24,0.25)]"
    >
      <div className="group relative overflow-hidden rounded-2xl">
        <Link to={`/product/${product.slug}`} tabIndex={-1} aria-hidden className="block">
          {/* Фото трохи наближається при наведенні */}
          <div className="transition-transform duration-500 group-hover:scale-[1.04]">
            <ProductImage src={product.images[0]} alt={name} tint={TINTS[index % TINTS.length]} />
          </div>
        </Link>
        <TagBadges tags={product.tags} className="pointer-events-none absolute top-2 right-14 left-2" />
        <FavoriteButton product={product} className="absolute top-2 right-2" />
        {/* Походження — плашкою внизу фото: під назвою не займає місця, тож картки з батьками й без однакові.
            Кожен батько — окреме посилання в пошук. */}
        {product.category === PLANT_CATEGORY && (
          <ParentsLinks
            parents={product.parents}
            origin={product.origin}
            habitat={product.habitat}
            className="absolute right-2 bottom-2 left-2 w-fit max-w-[calc(100%-1rem)] rounded-2xl bg-sand-50/90 p-1 pl-2 shadow-sm backdrop-blur"
          />
        )}
      </div>
      {/* flex-1: кнопки «У кошик» стоять на одній лінії, навіть якщо назви різної довжини.
          Вид окремо не пишемо — він і так перше слово назви («Echeveria Lola») */}
      <Link to={`/product/${product.slug}`} className="group mx-1.5 mt-2.5 flex flex-1 justify-between gap-3">
        <h3 className="leading-snug font-bold group-hover:text-brand-600">{name}</h3>
        <span className="font-display text-lg leading-snug font-extrabold whitespace-nowrap text-sunset-600">
          {formatPrice(product.price, lang)}
        </span>
      </Link>
      {/* Продавцю — кнопка редагування поруч із «У кошик» */}
      <div className="mt-2.5 flex gap-2">
        <div className="min-w-0 flex-1">
          <AddToCart product={product} />
        </div>
        {isSeller && (
          <Link
            to={`/admin/products/${product.id}`}
            aria-label={t('admin.editNamed', { name })}
            title={t('admin.edit')}
            className="flex min-h-11 w-11 shrink-0 items-center justify-center self-stretch rounded-xl border-2 border-brand-600 text-brand-600 transition-colors hover:bg-brand-600 hover:text-sand-50"
          >
            <Pencil size={18} strokeWidth={2.25} aria-hidden />
          </Link>
        )}
      </div>
    </article>
  )
}

export function ProductGrid({ products }: { products: Product[] }) {
  // Товари, яких немає в наявності, — завжди в кінці. Сортування стабільне, тож вибраний порядок
  // (новизна, ціна) всередині «є в наявності» і «немає» зберігається.
  const ordered = [...products].sort((a, b) => Number(a.stock === 0) - Number(b.stock === 0))
  // Інший набір товарів (фільтр, сортування) — знову з першої порції
  const { visible, sentinel } = useProgressive(ordered, PAGE, ordered.map((p) => p.id).join(','))
  return (
    <>
      <div className="grid grid-cols-1 gap-5 min-[480px]:grid-cols-2 lg:grid-cols-3">
        {visible.map((p, i) => (
          <ProductCard key={p.id} product={p} index={i} />
        ))}
      </div>
      {sentinel}
    </>
  )
}
