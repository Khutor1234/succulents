import { ChevronLeft, ChevronRight, Copy, Eye, EyeOff, Package, Pencil, Trash2 } from 'lucide-react'
import { useRef, useState, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useLang } from '../../i18n'
import { formatPrice, pick } from '../../lib/format'
import { PLANT_CATEGORY } from '../../lib/plants'
import type { Product } from '../../lib/types'
import { ProductImage } from '../../shared/ui'
import { useProgressive } from '../../shared/useProgressive'
import { useAuth } from '../auth/authStore'
import { useDeleteProduct, useToggleProductActive } from '../admin/api'
import { AddToCart } from '../cart/AddToCart'
import { FavoriteButton } from '../favorites/FavoriteButton'
import { ParentsLinks } from './ParentsLinks'
import { TagBadges } from './PlantFilters'

// Картки по черзі отримують теплий пісочний і оливковий фон — як у макеті «Пустеля».
const TINTS = ['bg-sand-300/60', 'bg-brand-100']
// Службові плашки продавця («Приховано», залишок): квадратніші за теги, дрібні великі літери
const SELLER_BADGE =
  'inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] leading-none font-extrabold tracking-wide whitespace-nowrap uppercase shadow-sm ring-1 ring-sand-50/70'
// Скільки карток показуємо за раз (решта — коли догортали донизу)
const PAGE = 24

/** `fullNames` — не обрізати довгі назви батьків на фото (для дрібних карток «Пов’язані рослини»). */
export function ProductCard({ product, index = 0, fullNames = false }: { product: Product; index?: number; fullNames?: boolean }) {
  const { t } = useTranslation()
  const lang = useLang()
  const name = pick(product.name, lang)
  const isSeller = useAuth((s) => s.role === 'seller')
  // Кілька фото — гортаються пальцем (або стрілками на комп’ютері); крапки під фото показують, котре зараз
  const [photo, setPhoto] = useState(0)
  const photosRef = useRef<HTMLDivElement>(null)
  const photoCount = product.images.length
  const showPhoto = (i: number) => {
    const el = photosRef.current
    if (el) el.scrollTo({ left: Math.max(0, Math.min(i, photoCount - 1)) * el.clientWidth, behavior: 'smooth' })
  }

  return (
    // Картки з'являються одна за одною (затримка за індексом) і легко піднімаються при наведенні
    <article
      style={{ animationDelay: `${Math.min(index % PAGE, 11) * 45}ms` }}
      className="@container flex animate-rise flex-col rounded-3xl border-2 border-sand-200 bg-sand-50 p-3 transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-1 hover:border-sand-300 hover:shadow-[0_12px_30px_-12px_rgba(43,33,24,0.25)]"
    >
      <div className="group relative overflow-hidden rounded-2xl">
        {/* Фото трохи наближається при наведенні; приховане — бліде, щоб одразу було видно, що покупці його не бачать */}
        <div
          className={`transition-[transform,opacity,filter] duration-500 group-hover:scale-[1.04] ${
            product.isActive ? '' : 'opacity-60 grayscale-[40%] group-hover:opacity-100 group-hover:grayscale-0'
          }`}
        >
          <CardPhotos product={product} alt={name} tint={TINTS[index % TINTS.length]} onIndex={setPhoto} scrollRef={photosRef} />
        </div>
        {/* Прихований товар у картках бачить лише продавець — плашка першою в ряду тегів на фото */}
        {/* Продавцю — службові плашки першими в ряду тегів: прихований чи ні й скільки на складі.
            Навмисно інший вигляд, ніж у тегів (квадратніші, дрібні великі літери), — щоб не плутати з тим, що бачать покупці. */}
        {/* У продавця немає сердечка — плашкам можна до правого краю */}
        <TagBadges tags={product.tags} className={`pointer-events-none absolute top-2 left-2 ${isSeller ? 'right-2' : 'right-14'}`}>
          {isSeller && !product.isActive && (
            <span className={`${SELLER_BADGE} bg-ink/90 text-sand-50`}>
              <EyeOff size={12} strokeWidth={2.75} aria-hidden />
              {t('product.hidden')}
            </span>
          )}
          {isSeller && (
            <span className={`${SELLER_BADGE} text-white ${product.stock > 0 ? 'bg-brand-700/90' : 'bg-red-700/90'}`}>
              <Package size={12} strokeWidth={2.75} aria-hidden />
              {product.stock > 0 ? t('admin.stockBadge', { count: product.stock }) : t('admin.noStockBadge')}
            </span>
          )}
        </TagBadges>
        {!isSeller && <FavoriteButton product={product} className="absolute top-2 right-2" />}
        {/* Походження — плашкою внизу фото: під назвою не займає місця, тож картки з батьками й без однакові.
            Кожен батько — окреме посилання в пошук. */}
        {product.category === PLANT_CATEGORY && (
          <ParentsLinks
            parents={product.parents}
            origin={product.origin}
            habitat={product.habitat}
            fullNames={fullNames}
            className="absolute inset-x-2 bottom-2 rounded-2xl bg-sand-50/90 p-1.5 shadow-sm backdrop-blur"
          />
        )}
        {/* Стрілки — для миші (на телефоні гортають пальцем), з’являються при наведенні */}
        {photoCount > 1 &&
          ([-1, 1] as const).map((dir) => {
            const disabled = dir < 0 ? photo === 0 : photo === photoCount - 1
            const Icon = dir < 0 ? ChevronLeft : ChevronRight
            return (
              <button
                key={dir}
                type="button"
                onClick={() => showPhoto(photo + dir)}
                disabled={disabled}
                aria-label={t(dir < 0 ? 'gallery.prev' : 'gallery.next')}
                className={`absolute top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-sand-50/90 text-ink opacity-0 shadow-sm transition-opacity group-hover:opacity-100 hover:bg-sand-50 disabled:invisible md:flex ${
                  dir < 0 ? 'left-2' : 'right-2'
                }`}
              >
                <Icon size={18} strokeWidth={2.5} aria-hidden />
              </button>
            )
          })}
      </div>
      {photoCount > 1 && (
        <div className="mt-1 flex justify-center">
          {product.images.map((src, i) => (
            <button
              key={`${i}-${src}`}
              type="button"
              onClick={() => showPhoto(i)}
              aria-label={t('gallery.show', { n: i + 1 })}
              aria-current={i === photo}
              className="flex h-6 min-w-6 items-center justify-center"
            >
              <span className={`block h-1.5 rounded-full transition-all ${i === photo ? 'w-4 bg-brand-600' : 'w-1.5 bg-sand-300'}`} />
            </button>
          ))}
        </div>
      )}
      {/* flex-1: кнопки «У кошик» стоять на одній лінії, навіть якщо назви різної довжини.
          Вид окремо не пишемо — він і так перше слово назви («Echeveria Lola») */}
      <Link to={`/product/${product.slug}`} className="group mx-1.5 mt-2.5 flex flex-1 justify-between gap-3">
        <h3 className="leading-snug font-bold group-hover:text-brand-600">
          {name}
        </h3>
        <span className="font-display text-lg leading-snug font-extrabold whitespace-nowrap text-sunset-600">
          {formatPrice(product.price, lang)}
        </span>
      </Link>
      {/* Покупцю — «У кошик»; продавцю кошик не потрібен — замість нього редагування, копія й видалення */}
      <div className="mt-2.5 flex gap-2">
        {isSeller ? (
          <SellerActions product={product} name={name} />
        ) : (
          <div className="min-w-0 flex-1">
            <AddToCart product={product} />
          </div>
        )}
      </div>
    </article>
  )
}

export function ProductGrid({ products }: { products: Product[] }) {
  // Спершу ті, що є в наявності, далі «немає в наявності», у самому кінці — приховані (їх бачить лише продавець).
  // Сортування стабільне, тож вибраний порядок (новизна, ціна) всередині кожної групи зберігається.
  const ordered = [...products].sort((a, b) => rank(a) - rank(b))
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

const rank = (p: Product) => (!p.isActive ? 2 : p.stock === 0 ? 1 : 0)

const ICON_LINK =
  'flex min-h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 transition-colors disabled:opacity-50'

/** Кнопки продавця на картці: редагувати, показати/приховати, створити копію, видалити (з підтвердженням). */
function SellerActions({ product, name }: { product: Product; name: string }) {
  const { t } = useTranslation()
  const remove = useDeleteProduct()
  const toggle = useToggleProductActive()
  const VisIcon = product.isActive ? EyeOff : Eye
  return (
    <>
      <Link
        to={`/admin/products/${product.id}`}
        aria-label={t('admin.editNamed', { name })}
        className="flex min-h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-3 font-bold text-sand-50 transition-colors hover:bg-brand-700"
      >
        <Pencil size={18} strokeWidth={2.25} aria-hidden />
        {/* На вузькій картці (дві в ряд на телефоні) — лише олівець, щоб влізли всі кнопки */}
        <span className="hidden @[18rem]:inline">{t('admin.edit')}</span>
      </Link>
      {/* Око: прихований товар — показати покупцям, видимий — сховати */}
      <button
        type="button"
        onClick={() => toggle.mutate({ id: product.id, isActive: !product.isActive, stock: product.stock })}
        disabled={toggle.isPending}
        aria-label={t(product.isActive ? 'admin.hideNamed' : 'admin.showNamed', { name })}
        title={t(product.isActive ? 'admin.hide' : 'admin.show')}
        className={`${ICON_LINK} ${
          product.isActive
            ? 'border-sand-700 text-sand-700 hover:bg-sand-700 hover:text-sand-50'
            : 'border-brand-600 bg-brand-600 text-sand-50 hover:bg-brand-700'
        }`}
      >
        <VisIcon size={18} strokeWidth={2.25} aria-hidden />
      </button>
      <Link
        to={`/admin/products/new?copy=${product.id}`}
        aria-label={t('admin.copyNamed', { name })}
        title={t('admin.copy')}
        className={`${ICON_LINK} border-brand-600 text-brand-600 hover:bg-brand-600 hover:text-sand-50`}
      >
        <Copy size={18} strokeWidth={2.25} aria-hidden />
      </Link>
      <button
        type="button"
        onClick={() => window.confirm(t('admin.deleteProductConfirm', { name })) && remove.mutate(product.id)}
        disabled={remove.isPending}
        aria-label={t('admin.deleteNamed', { name })}
        title={t('admin.deleteProduct')}
        className={`${ICON_LINK} border-red-700 text-red-700 hover:bg-red-700 hover:text-white`}
      >
        <Trash2 size={18} strokeWidth={2.25} aria-hidden />
      </button>
    </>
  )
}

/**
 * Фото на картці. Одне — просто посилання на товар. Кілька — стрічка, яку гортають пальцем убік
 * (кожне фото «прилипає» на місце); торкання будь-якого фото відкриває товар.
 */
function CardPhotos({
  product,
  alt,
  tint,
  onIndex,
  scrollRef,
}: {
  product: Product
  alt: string
  tint: string
  onIndex: (i: number) => void
  scrollRef: RefObject<HTMLDivElement | null>
}) {
  const to = `/product/${product.slug}`
  if (product.images.length <= 1) {
    return (
      <Link to={to} tabIndex={-1} aria-hidden className="block">
        <ProductImage src={product.images[0]} alt={alt} tint={tint} />
      </Link>
    )
  }
  return (
    <div
      ref={scrollRef}
      onScroll={(e) => onIndex(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
      className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain rounded-2xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {product.images.map((src, i) => (
        <Link key={`${i}-${src}`} to={to} tabIndex={-1} aria-hidden className="block w-full shrink-0 snap-center">
          <ProductImage src={src} alt={i === 0 ? alt : ''} tint={tint} />
        </Link>
      ))}
    </div>
  )
}
