import { Ban, Check, CheckSquare, ChevronLeft, ChevronRight, Copy, Eye, EyeOff, Package, Pencil, Pin, Plus, Tag, Trash2 } from 'lucide-react'
import { useRef, useState, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useLang } from '../../i18n'
import { formatPrice, pick } from '../../lib/format'
import { withCuttingMark } from '../../lib/plantName'
import { PLANT_CATEGORY } from '../../lib/plants'
import type { Product } from '../../lib/types'
import { ProductImage } from '../../shared/ui'
import { useHere } from '../../shared/navigation'
import { useProgressive } from '../../shared/useProgressive'
import { useAuth } from '../auth/authStore'
import { useDeleteProduct, useSetStock, useToggleForSale, useToggleOnHome, useToggleProductActive } from '../admin/api'
import { BulkBar } from '../admin/BulkBar'
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

/**
 * `fullNames` — не обрізати довгі назви батьків на фото (для дрібних карток «Пов’язані рослини»);
 * `asBuyer` — і продавцю показати картку так, як її бачить покупець (вітрина «Нові надходження» на головній);
 *   лишається тільки шпилька «на головну» — щоб прибрати рослину з вітрини прямо там.
 */
export function ProductCard({
  product,
  index = 0,
  fullNames = false,
  asBuyer = false,
}: {
  product: Product
  index?: number
  fullNames?: boolean
  asBuyer?: boolean
}) {
  const { t } = useTranslation()
  const lang = useLang()
  const name = pick(product.name, lang)
  const realSeller = useAuth((s) => s.role === 'seller')
  const isSeller = realSeller && !asBuyer
  // Кілька фото — гортаються пальцем (або стрілками на комп’ютері); крапки під фото показують, котре зараз
  const [photo, setPhoto] = useState(0)
  const photosRef = useRef<HTMLDivElement>(null)
  const photoCount = product.images.length
  const showPhoto = (i: number) => {
    const el = photosRef.current
    if (el) el.scrollTo({ left: Math.max(0, Math.min(i, photoCount - 1)) * el.clientWidth, behavior: 'smooth' })
  }

  return (
    // Картка легко піднімається при наведенні
    <article
      // Продавцю картка одразу каже про стан (фото лишається яскравим):
      // прихований — лавандовий фон і пунктирна рамка; показаний, але закінчився — ніжний персиковий фон
      className={`@container flex flex-col rounded-3xl border-2 p-3 transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-1 hover:shadow-[0_12px_30px_-12px_rgba(43,33,24,0.25)] ${
        !product.isActive
          ? 'border-dashed border-lavender-400 bg-lavender-50 hover:border-lavender-700'
          : isSeller && product.stock === 0
            ? 'border-sunset-200 bg-sunset-100/50 hover:border-sunset-500'
            : 'border-sand-200 bg-sand-50 hover:border-sand-300'
      }`}
    >
      <div className="group relative overflow-hidden rounded-2xl">
        {/* Фото трохи наближається при наведенні */}
        <div className="transition-transform duration-500 group-hover:scale-[1.04]">
          <CardPhotos product={product} alt={name} tint={TINTS[index % TINTS.length]} onIndex={setPhoto} scrollRef={photosRef} />
        </div>
        {/* Прихований товар у картках бачить лише продавець — плашка першою в ряду тегів на фото */}
        {/* Продавцю — службові плашки першими в ряду тегів: прихований чи ні й скільки на складі.
            Навмисно інший вигляд, ніж у тегів (квадратніші, дрібні великі літери), — щоб не плутати з тим, що бачать покупці. */}
        <TagBadges tags={product.tags} className="pointer-events-none absolute top-2 right-14 left-2">
          {isSeller && !product.isActive && (
            <span className={`${SELLER_BADGE} bg-lavender-700/90 text-sand-50`}>
              <EyeOff size={12} strokeWidth={2.75} aria-hidden />
              {t('product.hidden')}
            </span>
          )}
          {isSeller && (
            <span className={`${SELLER_BADGE} text-sand-50 ${product.stock > 0 ? 'bg-brand-700/90' : 'bg-red-700/90'}`}>
              <Package size={12} strokeWidth={2.75} aria-hidden />
              {product.stock > 0 ? t('admin.stockBadge', { count: product.stock }) : t('admin.noStockBadge')}
            </span>
          )}
          {/* Продавцю — скільки покупців додали рослину в улюблене (у продавця немає сердечка-кнопки) */}
        </TagBadges>
        {/* Сердечко й кількість лайків поруч — для всіх */}
        <FavoriteButton product={product} className="absolute top-2 right-2" />
        {/* Продавцю — шпилька «на головну»: позначені рослини першими в «Нових надходженнях» */}
        {realSeller && <HomePin product={product} name={name} className="absolute top-14 right-2" />}
        {/* Походження — плашкою внизу фото: під назвою не займає місця, тож картки з батьками й без однакові.
            Кожен батько — окреме посилання в пошук. */}
        {product.category === PLANT_CATEGORY && (
          <ParentsLinks
            parents={product.parents}
            origin={product.origin}
            habitat={product.habitat}
            fullNames={fullNames}
            className="absolute inset-x-2 bottom-2 rounded-2xl bg-sand-50/95 p-1.5 shadow-sm"
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
      <div className="group mx-1.5 mt-2.5 flex flex-1 justify-between gap-3">
        {/* Продавцю — перед назвою «скопіювати назву» (напр., щоб вставити в таблицю чи переписку):
            на початку рядка вона на всіх картках на одному місці, хоч які довгі назви */}
        <div className="flex min-w-0 items-start gap-1">
          {isSeller && <CopyName name={name} className="-ml-1.5" />}
          <h3 className="leading-snug font-bold">
            <Link to={`/product/${product.slug}`} className="hover:text-brand-600">
              {withCuttingMark(name, product.tags?.includes('cutting'), t('product.cuttingMark'))}
            </Link>
          </h3>
        </div>
        <Link
          to={`/product/${product.slug}`}
          tabIndex={-1}
          className="font-display text-lg leading-snug font-extrabold whitespace-nowrap text-sunset-600"
        >
          {formatPrice(product.price, lang)}
        </Link>
      </div>
      {/* Покупцю — «У кошик»; продавцю кошик не потрібен — замість нього редагування, копія й видалення */}
      {isSeller && <SellerStock product={product} />}
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

/**
 * Сітка карток.
 * - `sellerTools` — продавцю над сіткою «Вибрати» (масові дії над кількома товарами) і «Додати» (новий товар у цю категорію);
 * - `keepOrder` — не групувати «в наявності / немає / приховані» (коли продавець вибрав своє сортування, напр. «Спершу без фото»);
 * - `asBuyer` — картки й продавцю як у покупця (див. ProductCard).
 */
export function ProductGrid({
  products,
  sellerTools,
  keepOrder = false,
  asBuyer = false,
}: {
  products: Product[]
  sellerTools?: { category?: string }
  keepOrder?: boolean
  asBuyer?: boolean
}) {
  const { t } = useTranslation()
  const lang = useLang()
  const isSeller = useAuth((s) => s.role === 'seller')
  // Спершу ті, що є в наявності, далі «немає в наявності», у самому кінці — приховані (їх бачить лише продавець).
  // Сортування стабільне, тож вибраний порядок (новизна, ціна) всередині кожної групи зберігається.
  const ordered = keepOrder ? products : [...products].sort((a, b) => rank(a) - rank(b))
  // Інший набір товарів (фільтр, пошук) — знову з першої порції. Ключ — без порядку: коли товар лише показали чи
  // приховали (і він перейшов в іншу групу), список не скидається й сторінка не стрибає вгору
  const { visible, sentinel } = useProgressive(ordered, PAGE, products.map((p) => p.id).sort().join(','))
  // Масові дії: режим вибору й вибрані товари
  const tools = isSeller && sellerTools
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const toggleSelected = (id: string) =>
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <>
      {tools && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setSelecting(!selecting)
              setSelected(new Set())
            }}
            aria-pressed={selecting}
            className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl border-2 px-4 font-bold transition-colors ${
              selecting ? 'border-brand-600 bg-brand-600 text-sand-50' : 'border-sand-300 bg-sand-50 text-ink hover:border-brand-600'
            }`}
          >
            <CheckSquare size={18} strokeWidth={2.25} aria-hidden />
            {t('admin.bulk.choose')}
          </button>
          <Link
            to={sellerTools.category ? `/admin/products/new?category=${sellerTools.category}` : '/admin/products/new'}
            className="ml-auto inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-brand-600 px-4 font-bold text-sand-50 transition-colors hover:bg-brand-700"
          >
            <Plus size={18} strokeWidth={2.5} aria-hidden />
            {t('admin.addProduct')}
          </Link>
        </div>
      )}
      <div className="grid grid-cols-1 gap-5 min-[480px]:grid-cols-2 lg:grid-cols-3">
        {visible.map((p, i) => {
          const on = selected.has(p.id)
          return (
            <div key={p.id} className="relative flex flex-col [&>article]:flex-1">
              <ProductCard product={p} index={i} asBuyer={asBuyer} />
              {/* Режим вибору: картка — одна велика кнопка-галочка (кнопки картки й посилання не спрацьовують) */}
              {tools && selecting && (
                <button
                  type="button"
                  onClick={() => toggleSelected(p.id)}
                  aria-pressed={on}
                  aria-label={t(on ? 'admin.bulk.unselect' : 'admin.bulk.select', { name: pick(p.name, lang) })}
                  className={`absolute inset-0 rounded-3xl border-4 transition-colors ${on ? 'border-brand-600 bg-brand-600/15' : 'border-transparent hover:bg-ink/5'}`}
                >
                  <span
                    className={`absolute top-3 right-3 flex h-9 w-9 items-center justify-center rounded-xl border-2 shadow ${
                      on ? 'border-brand-600 bg-brand-600 text-sand-50' : 'border-sand-300 bg-sand-50 text-transparent'
                    }`}
                  >
                    <Check size={20} strokeWidth={3} aria-hidden />
                  </span>
                </button>
              )}
            </div>
          )
        })}
      </div>
      {sentinel}
      {tools && selecting && (
        <BulkBar
          selected={products.filter((p) => selected.has(p.id))}
          total={products.length}
          onSelectAll={() => setSelected(new Set(products.map((p) => p.id)))}
          onClear={() => setSelected(new Set())}
          onClose={() => {
            setSelecting(false)
            setSelected(new Set())
          }}
        />
      )}
    </>
  )
}

const rank = (p: Product) => (!p.isActive ? 2 : p.stock === 0 ? 1 : 0)

const ICON_BASE = 'flex shrink-0 items-center justify-center rounded-xl border-2 transition-colors disabled:opacity-50'
const ICON_LINK = `${ICON_BASE} min-h-11 w-11`
/** Квадратна кнопка-іконка продавця: на картці — 44 px; `compact` — менша, для рядків списку товарів в адмінці. */
const iconBtn = (compact = false) => (compact ? `${ICON_BASE} h-9 w-9` : ICON_LINK)

/** Кнопки продавця на картці: редагувати, показати/приховати, у продажу / не продається, видалити (з підтвердженням). */
/**
 * Продавцю на картці: «На складі − N +» — змінити залишок одразу, без форми редагування.
 * Число змінюється миттєво; у базу зберігаємо, коли кнопки на мить перестали натискати (щоб не писати на кожен клік).
 */
export function SellerStock({ product, compact = false }: { product: Product; compact?: boolean }) {
  const { t } = useTranslation()
  const save = useSetStock()
  const [value, setValue] = useState(product.stock)
  const [base, setBase] = useState(product.stock)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [editing, setEditing] = useState(false)
  // Залишок змінився деінде (форма, замовлення) — показуємо новий, якщо тут саме нічого не змінюють
  if (product.stock !== base && !editing && !save.isPending) {
    setBase(product.stock)
    setValue(product.stock)
  }
  // Останнє значення — у ref: кілька швидких натискань поспіль мають додаватися, а не перезаписувати одне одного
  const latest = useRef(value)
  const change = (d: number) => {
    setValue((v) => {
      const next = Math.max(0, v + d)
      latest.current = next
      return next
    })
    setEditing(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      timer.current = null
      const next = latest.current
      setEditing(false)
      setBase(next)
      if (next !== product.stock) save.mutate({ id: product.id, stock: next })
    }, 600)
  }
  const btn = `flex ${compact ? 'h-8 w-8' : 'h-9 w-9'} items-center justify-center rounded-lg text-lg font-bold leading-none hover:bg-sand-200 disabled:opacity-30`
  const stepper = (
    <div className="flex items-center rounded-xl border-2 border-sand-200 bg-sand-50" role="group" aria-label={t('admin.fields.stock')}>
      <button type="button" className={btn} onClick={() => change(-1)} disabled={value === 0} aria-label={t('cart.decrease')}>
        −
      </button>
      <span className={`${compact ? 'w-8' : 'w-9'} text-center font-extrabold tabular-nums ${value === 0 ? 'text-red-700' : ''}`} aria-live="polite">
        {value}
      </span>
      <button type="button" className={btn} onClick={() => change(1)} aria-label={t('cart.increase')}>
        +
      </button>
    </div>
  )
  if (compact) return stepper
  return (
    <div className="mx-1.5 mt-2 flex items-center justify-between gap-2 text-sm">
      <span className={`font-bold ${value === 0 ? 'text-red-700' : 'text-sand-700'}`}>{t('admin.fields.stock')}</span>
      {stepper}
    </div>
  )
}

/** Шпилька «на головну»: позначена — зелена й зафарбована. */
export function HomePin({ product, name, className = '', compact = false }: { product: Product; name: string; className?: string; compact?: boolean }) {
  const { t } = useTranslation()
  const toggle = useToggleOnHome()
  const on = !!product.onHome
  const label = t(on ? 'admin.onHomeRemove' : 'admin.onHomeAdd', { name })
  return (
    <button
      type="button"
      onClick={(e) => {
        // Кнопка лежить на фото-посиланні — не відкриваємо товар
        e.preventDefault()
        e.stopPropagation()
        toggle.mutate({ id: product.id, onHome: !on })
      }}
      disabled={toggle.isPending}
      aria-pressed={on}
      aria-label={label}
      title={label}
      className={
        compact
          ? `${iconBtn(true)} ${on ? 'border-brand-600 bg-brand-600 text-sand-50 hover:bg-brand-700' : 'border-sand-300 text-sand-700 hover:border-brand-600'} ${className}`
          : `flex h-10 w-10 items-center justify-center rounded-full shadow-sm transition-transform hover:scale-110 active:scale-95 disabled:opacity-60 ${
              on ? 'bg-brand-600 text-sand-50' : 'bg-sand-50/95 text-ink'
            } ${className}`
      }
    >
      <Pin size={18} strokeWidth={2.25} fill={on ? 'currentColor' : 'none'} aria-hidden />
    </button>
  )
}

/** Копіює назву рослини в буфер обміну; на мить показує галочку «Скопійовано». */
export function CopyName({ name, className = '' }: { name: string; className?: string }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(name)
    } catch {
      // Старіші браузери без доступу до буфера — через тимчасове поле
      const el = document.createElement('textarea')
      el.value = name
      el.style.cssText = 'position:fixed;opacity:0'
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      el.remove()
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button
      type="button"
      onClick={() => void copy()}
      aria-label={t(copied ? 'admin.nameCopied' : 'admin.copyName', { name })}
      title={t(copied ? 'admin.nameCopied' : 'admin.copyName', { name })}
      // Невелика, перед назвою (висотою з рядок назви)
      className={`-my-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors active:scale-95 ${
        copied ? 'bg-brand-100 text-brand-700' : 'text-sand-700 hover:bg-sand-200 hover:text-ink'
      } ${className}`}
    >
      {copied ? <Check size={16} strokeWidth={2.75} aria-hidden /> : <Copy size={16} strokeWidth={2.25} aria-hidden />}
    </button>
  )
}

/**
 * Продавцю: «У продажу» / «Не продається» — квадратна кнопка-іконка в ряду кнопок картки. Не на продаж — покупці бачать
 * «немає в наявності», а продавець і далі бачить справжній залишок (рослина є в колекції, але її не продають).
 * Зафарбована — у продажу (покупці бачать увесь залишок). Коли на складі 0 — продавати нічого:
 * тоді кнопка сіра й нічого не перемикає (лише плутало б), а натискання чи наведення показує пояснення.
 */
export function ForSaleButton({ product, name, compact = false }: { product: Product; name: string; compact?: boolean }) {
  const { t } = useTranslation()
  const toggle = useToggleForSale()
  const forSale = product.forSale !== false
  // На складі нічого — не перемикається: продавати нічого, спершу додайте кількість
  const locked = product.stock === 0
  const lockedHint = t('admin.noStockForSale')
  const sellable = forSale && !locked
  const [hint, setHint] = useState(false)
  const Icon = sellable ? Tag : Ban
  return (
    <span className="group/hint relative flex">
      <button
        type="button"
        onClick={() => (locked ? setHint((v) => !v) : toggle.mutate({ id: product.id, forSale: !forSale }))}
        onBlur={() => setHint(false)}
        disabled={toggle.isPending}
        aria-disabled={locked}
        aria-pressed={locked ? undefined : forSale}
        aria-label={locked ? lockedHint : t(forSale ? 'admin.unsellNamed' : 'admin.sellNamed', { name })}
        title={locked ? undefined : t(forSale ? 'admin.unsell' : 'admin.sell')}
        className={`${iconBtn(compact)} relative ${
          locked
            ? 'cursor-not-allowed border-sand-300 bg-sand-200 text-sand-500'
            : sellable
              ? 'border-brand-600 bg-brand-600 text-sand-50 hover:bg-brand-700'
              : 'border-sand-700 text-sand-700 hover:bg-sand-200'
        }`}
      >
        <Icon size={18} strokeWidth={2.25} aria-hidden />
      </button>
      {locked && (
        <span
          role="tooltip"
          className={`absolute right-0 bottom-full z-20 mb-2 w-56 rounded-xl bg-ink px-3 py-2 text-xs leading-snug font-bold text-sand-50 shadow-lg ${
            hint ? 'block' : 'hidden group-hover/hint:block'
          }`}
        >
          {lockedHint}
        </span>
      )}
    </span>
  )
}

function SellerActions({ product, name }: { product: Product; name: string }) {
  const { t } = useTranslation()
  // Після збереження форма повернеться на цю сторінку (каталог, пошук, головна…)
  const here = useHere()
  return (
    <>
      <Link
        to={`/admin/products/${product.id}`}
        state={{ from: here }}
        aria-label={t('admin.editNamed', { name })}
        className="flex min-h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-3 font-bold text-sand-50 transition-colors hover:bg-brand-700"
      >
        <Pencil size={18} strokeWidth={2.25} aria-hidden />
        {/* На вузькій картці (дві в ряд на телефоні) — лише олівець, щоб влізли всі кнопки */}
        <span className="hidden @[18rem]:inline">{t('admin.edit')}</span>
      </Link>
      <VisibilityButton product={product} name={name} />
      {/* У продажу / не продається */}
      <ForSaleButton product={product} name={name} />
      <DeleteButton product={product} name={name} />
    </>
  )
}

/**
 * Око показує стан: зафарбоване з відкритим оком — товар бачать покупці; порожнє з перекресленим — прихований.
 * Натискання перемикає.
 */
export function VisibilityButton({ product, name, compact = false }: { product: Product; name: string; compact?: boolean }) {
  const { t } = useTranslation()
  const toggle = useToggleProductActive()
  const VisIcon = product.isActive ? Eye : EyeOff
  return (
    <button
      type="button"
      onClick={() => toggle.mutate({ id: product.id, isActive: !product.isActive })}
      disabled={toggle.isPending}
      aria-label={t(product.isActive ? 'admin.hideNamed' : 'admin.showNamed', { name })}
      title={t(product.isActive ? 'admin.hide' : 'admin.show')}
      aria-pressed={product.isActive}
      className={`${iconBtn(compact)} ${
        product.isActive
          ? 'border-brand-600 bg-brand-600 text-sand-50 hover:bg-brand-700'
          : 'border-sand-700 text-sand-700 hover:bg-sand-200'
      }`}
    >
      <VisIcon size={18} strokeWidth={2.25} aria-hidden />
    </button>
  )
}

/** Видалити товар (з підтвердженням). `onDeleted` — що робити після (напр., піти зі сторінки товару). */
export function DeleteButton({
  product,
  name,
  compact = false,
  onDeleted,
}: {
  product: Product
  name: string
  compact?: boolean
  onDeleted?: () => void
}) {
  const { t } = useTranslation()
  const remove = useDeleteProduct()
  return (
    <button
      type="button"
      onClick={() => window.confirm(t('admin.deleteProductConfirm', { name })) && remove.mutate(product.id, { onSuccess: onDeleted })}
      disabled={remove.isPending}
      aria-label={t('admin.deleteNamed', { name })}
      title={t('admin.deleteProduct')}
      className={`${iconBtn(compact)} border-red-700 text-red-700 hover:bg-red-700 hover:text-sand-50`}
    >
      <Trash2 size={18} strokeWidth={2.25} aria-hidden />
    </button>
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
