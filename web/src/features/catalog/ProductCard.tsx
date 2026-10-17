import { Link } from 'react-router'
import { useLang } from '../../i18n'
import { formatPrice, pick } from '../../lib/format'
import type { Product } from '../../lib/types'
import { ProductImage } from '../../shared/ui'
import { AddToCart } from '../cart/AddToCart'
import { TagBadges } from './PlantFilters'

// Картки по черзі отримують теплий пісочний і оливковий фон — як у макеті «Пустеля».
const TINTS = ['bg-sand-300/60', 'bg-brand-100']

export function ProductCard({ product, index = 0 }: { product: Product; index?: number }) {
  const lang = useLang()
  const name = pick(product.name, lang)

  return (
    // Картки з'являються одна за одною (затримка за індексом) і легко піднімаються при наведенні
    <article
      style={{ animationDelay: `${Math.min(index, 11) * 45}ms` }}
      className="flex animate-rise flex-col rounded-3xl border-2 border-sand-200 bg-sand-50 p-3 transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-1 hover:border-sand-300 hover:shadow-[0_12px_30px_-12px_rgba(43,33,24,0.25)]"
    >
      {/* flex-1: кнопки «У кошик» стоять на одній лінії, навіть якщо назви різної довжини */}
      <Link to={`/product/${product.slug}`} className="group block flex-1">
        <div className="relative overflow-hidden rounded-2xl">
          {/* Фото трохи наближається при наведенні */}
          <div className="transition-transform duration-500 group-hover:scale-[1.04]">
            <ProductImage src={product.images[0]} alt={name} tint={TINTS[index % TINTS.length]} />
          </div>
          <TagBadges tags={product.tags} className="absolute top-2 left-2 right-2" />
        </div>
        {product.genus && <p className="mx-1.5 mt-3 text-xs font-bold tracking-wide text-sand-700 italic">{product.genus}</p>}
        <div className={`mx-1.5 flex justify-between gap-3 ${product.genus ? 'mt-0.5' : 'mt-3.5'}`}>
          <h3 className="line-clamp-2 font-bold group-hover:text-brand-600">{name}</h3>
          <span className="font-display text-lg font-extrabold whitespace-nowrap text-sunset-600">
            {formatPrice(product.price, lang)}
          </span>
        </div>
      </Link>
      <div className="mt-3">
        <AddToCart product={product} />
      </div>
    </article>
  )
}

export function ProductGrid({ products }: { products: Product[] }) {
  // Товари, яких немає в наявності, — завжди в кінці. Сортування стабільне, тож вибраний порядок
  // (новизна, ціна) всередині «є в наявності» і «немає» зберігається.
  const ordered = [...products].sort((a, b) => Number(a.stock === 0) - Number(b.stock === 0))
  return (
    <div className="grid grid-cols-1 gap-5 min-[480px]:grid-cols-2 lg:grid-cols-4">
      {ordered.map((p, i) => (
        <ProductCard key={p.id} product={p} index={i} />
      ))}
    </div>
  )
}
