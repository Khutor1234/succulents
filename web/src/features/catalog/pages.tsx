import { ArrowLeft, ArrowRight, BookOpen, EyeOff, Gift, Info, Pencil, Truck } from 'lucide-react'
import { lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, NavLink, useNavigate, useParams } from 'react-router'
import { canGoBack, useHere } from '../../shared/navigation'
import { ICON } from '../../shared/icon'
import { useLang } from '../../i18n'
import { formatPrice, pick } from '../../lib/format'
import { PageTitle, Select } from '../../shared/ui'
import { useBonusBalance } from '../account/api'
import { SellerOrdersPanel } from '../admin/SellerOrdersPanel'
import { useAuth } from '../auth/authStore'
import { AddToCart } from '../cart/AddToCart'
import { FavoriteButton } from '../favorites/FavoriteButton'
import { useLatestProducts, useProduct, useProducts } from './api'
import { PLANT_CATEGORY } from '../../lib/plants'
import { useCategories } from './categories'
import { ParentsLinks } from './ParentsLinks'
import { PlantFilters, TagBadges } from './PlantFilters'
import { SELLER_SORTS, SORTS, usePlantFilters, type SortOrder } from './usePlantFilters'
import { ProductGrid } from './ProductCard'
import { ProductGallery } from './ProductGallery'
import { RelatedPlants } from './RelatedPlants'

// Статті на головній довантажуються окремо — щоб тексти блогу не гальмували перше відкриття сайту
const HomeArticles = lazy(() => import('../blog/HomeArticles'))
// Скільки новинок показати на головній і зі скількох найновіших вибирати (частину відсіюємо: немає в наявності, приховані)
const LATEST_COUNT = 8
const LATEST_POOL = 40

function Status({ isLoading, isError }: { isLoading: boolean; isError: boolean }) {
  const { t } = useTranslation()
  if (isLoading) return <p className="text-sand-700">{t('loading')}</p>
  if (isError) return <p className="text-red-700">{t('errors.loading')}</p>
  return null
}

/** Кактус на пагорбах під сонцем — ілюстрація для першого екрана. */
function DesertIllustration() {
  return (
    <svg
      viewBox="0 0 200 140"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="w-72 max-w-full"
    >
      <path d="M100 140V46c0-10 12-10 12 0v94" />
      <path d="M112 82h10c6 0 8-4 8-10V58c0-8 10-8 10 0v16c0 12-8 20-18 20h-10" />
      <path d="M100 96H88c-10 0-16-8-16-18V66c0-8 10-8 10 0v10c0 6 2 9 8 9h10" />
      <path d="M0 132c40-14 70-14 100-4s70 8 100-6" />
      <circle cx="160" cy="30" r="14" />
    </svg>
  )
}

export function CategoryPills() {
  const { visible, nameOf } = useCategories()
  return (
    // Телефон: один рядок, що гортається пальцем убік (не три рядки кнопок над товарами); ширше — переноситься
    <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:gap-2.5 sm:overflow-visible sm:px-0 sm:pb-0 [&::-webkit-scrollbar]:hidden">
      {visible.map((c, i) => (
        <NavLink
          key={c}
          to={`/c/${c}`}
          className={({ isActive }) =>
            `shrink-0 rounded-full px-4 py-2.5 font-bold whitespace-nowrap sm:px-5 sm:py-3 ${isActive ? 'bg-brand-600 text-sand-50' : i % 2 ? 'bg-sand-200 hover:bg-sand-300' : 'bg-sand-300 hover:bg-sand-400'}`
          }
        >
          {nameOf(c)}
        </NavLink>
      ))}
    </nav>
  )
}

/**
 * Банер бонусної програми.
 * Гість бачить «100 грн за реєстрацію + 10%». Залогінений вітальні 100 грн уже отримав (або отримає після
 * підтвердження пошти — про це окрема смужка під шапкою), тож йому лише про 10% і його баланс.
 */
function BonusPromo({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation()
  const lang = useLang()
  const user = useAuth((s) => s.user)
  const isSeller = useAuth((s) => s.role === 'seller')
  const { balance } = useBonusBalance()

  // Продавець не купує — бонусна програма йому ні до чого
  if (isSeller) return null

  // Компактна смужка — для сторінок категорій, щоб не відсувати товари вниз.
  if (compact) {
    const text = user
      ? balance > 0
        ? t('welcome.stripBalance', { amount: formatPrice(balance, lang) })
        : t('welcome.cashbackTitle')
      : t('welcome.stripGuest')
    return (
      <Link
        to={user ? '/account' : '/login?mode=signup'}
        className="group flex items-center gap-3 rounded-2xl border-2 border-dashed border-sunset-500 bg-sand-50 px-4 py-3 transition-colors hover:bg-sand-200"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sunset-600 text-sand-50">
          <Gift {...ICON} />
        </span>
        <span className="flex-1 text-sm font-bold">{text}</span>
        <ArrowRight {...ICON} className="shrink-0 text-sunset-600 transition-transform group-hover:translate-x-1" />
      </Link>
    )
  }

  if (user) {
    return (
      <section className="flex flex-wrap items-center gap-x-8 gap-y-4 rounded-[32px] border-2 border-dashed border-brand-500 bg-sand-50 px-6 py-6 sm:px-8">
        <span className="flex items-center gap-3 font-display text-5xl font-extrabold text-brand-600">
          <Gift size={40} strokeWidth={2} aria-hidden />
          10%
        </span>
        <div className="min-w-60 flex-1">
          <p className="font-display text-2xl font-extrabold text-brand-600">{t('welcome.cashbackTitle')}</p>
          <p className="mt-1 text-sand-700">
            {balance > 0 ? t('welcome.cashbackBalance', { amount: formatPrice(balance, lang) }) : t('welcome.cashbackText')}
          </p>
        </div>
        <Link to="/account" className="rounded-xl bg-sand-200 px-6 py-3.5 font-bold hover:bg-sand-300">
          {t('welcome.toAccount')}
        </Link>
      </section>
    )
  }

  return (
    <section className="flex flex-wrap items-center gap-x-8 gap-y-4 rounded-[32px] border-2 border-dashed border-sunset-500 bg-sand-50 px-6 py-6 sm:px-8">
      <div className="flex items-baseline gap-3">
        <Gift size={40} strokeWidth={2} aria-hidden className="self-center text-sunset-600" />
        <span className="font-display text-5xl font-extrabold text-sunset-600">100 ₴</span>
        <span className="font-display text-3xl font-extrabold text-brand-600">+10%</span>
      </div>
      <div className="min-w-60 flex-1">
        <p className="font-display text-2xl font-extrabold text-brand-600">{t('welcome.promoTitle')}</p>
        <p className="mt-1 text-sand-700">{t('welcome.promoText')}</p>
      </div>
      <Link to="/login?mode=signup" className="rounded-xl bg-sunset-600 px-6 py-3.5 font-bold text-sand-50 hover:bg-sunset-700">
        {t('welcome.promoCta')}
      </Link>
    </section>
  )
}

export function HomePage() {
  const { t } = useTranslation()
  // Новинки на головній — і продавцю лише показані: це вітрина магазину, приховані (часто ще без фото) тут лише заважають.
  // Покупцю — лише те, що можна купити (є в наявності). Продавцю — справжні залишки (withHidden), щоб «±» на картці
  // змінювали справжнє число, а не те, що бачить покупець. Беремо з запасом, бо частину відсіюємо.
  const isSeller = useAuth((s) => s.role === 'seller')
  const latest = useLatestProducts(LATEST_POOL, isSeller)
  const { visible, isVisible } = useCategories()
  const firstCategory = visible[0] ?? 'plants'
  const shown = latest.data
    ?.filter((p) => isVisible(p.category) && (isSeller ? p.isActive : p.stock > 0))
    .slice(0, LATEST_COUNT)

  return (
    <div className="space-y-12">
      <SellerOrdersPanel />
      <section className="grid gap-5 md:grid-cols-2">
        <div className="flex min-h-[420px] flex-col justify-between gap-8 rounded-[32px] bg-sunset-600 p-8 text-sand-50 sm:p-10">
          <p className="text-[13px] font-bold tracking-[0.14em] uppercase">{t('home.eyebrow')}</p>
          <h1 className="font-display text-5xl leading-[0.98] font-extrabold sm:text-6xl">{t('home.title')}</h1>
          <div className="flex flex-wrap gap-3">
            <Link
              to={`/c/${firstCategory}`}
              className="group inline-flex items-center gap-2 rounded-xl bg-sand-50 px-6 py-3.5 font-bold text-ink transition-transform hover:bg-sand-100 active:scale-[0.97]"
            >
              {t('home.toCatalog')}
              <ArrowRight {...ICON} className="transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              to="/blog"
              className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3.5 font-bold text-sand-50 transition-transform hover:bg-brand-700 active:scale-[0.97]"
            >
              <BookOpen {...ICON} />
              {t('blog.title')}
            </Link>
          </div>
        </div>
        <div className="grid grid-rows-[1fr_auto] gap-5">
          <div className="flex min-h-[260px] items-end justify-center overflow-hidden rounded-[32px] bg-sand-300 text-brand-600">
            <DesertIllustration />
          </div>
          <div className="flex items-start gap-4 rounded-3xl bg-brand-600 px-6 py-5 text-sand-100">
            <Truck size={32} strokeWidth={2} aria-hidden className="mt-1 shrink-0 text-sand-300" />
            <div>
              <p className="font-display text-2xl font-extrabold">{t('home.deliveryTitle')}</p>
              <p className="mt-1">{t('home.deliveryText')}</p>
            </div>
          </div>
        </div>
      </section>

      <BonusPromo />

      <CategoryPills />

      <section>
        <div className="mb-5 flex flex-wrap items-baseline gap-4">
          <h2 className="font-display text-4xl font-extrabold text-brand-600">{t('home.newArrivals')}</h2>
          <Link to={`/c/${firstCategory}`} className="group ml-auto inline-flex items-center gap-1.5 font-bold text-brand-600 hover:underline">
            {t('home.allProductsShort')}
            <ArrowRight {...ICON} className="transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
        <Status isLoading={latest.isLoading} isError={latest.isError} />
        {shown && <ProductGrid products={shown} />}
      </section>

      {/* Блог: три свіжі статті про догляд */}
      <section>
        <div className="mb-5 flex flex-wrap items-baseline gap-4">
          <h2 className="font-display text-4xl font-extrabold text-brand-600">{t('blog.homeTitle')}</h2>
          <Link to="/blog" className="group ml-auto inline-flex items-center gap-1.5 font-bold text-brand-600 hover:underline">
            {t('blog.all')}
            <ArrowRight {...ICON} className="transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
        <Suspense fallback={null}>
          <HomeArticles />
        </Suspense>
      </section>
    </div>
  )
}

export function CategoryPage() {
  const { t } = useTranslation()
  const { category } = useParams()
  const { isVisible, nameOf, isLoading: settingsLoading } = useCategories()
  const isSeller = useAuth((s) => s.role === 'seller')
  const products = useProducts(category ?? '', isSeller)
  const filters = usePlantFilters()

  if (!category || (!settingsLoading && !isVisible(category))) return <Navigate to="/" replace />

  const shown = products.data ? filters.apply(products.data) : undefined

  return (
    <div className="space-y-6">
      <PageTitle>{nameOf(category)}</PageTitle>
      <CategoryPills />
      <BonusPromo compact />
      <Status isLoading={products.isLoading} isError={products.isError} />
      {products.data?.length === 0 && <p className="text-sand-700">{t('catalog.empty')}</p>}
      {products.data && products.data.length > 0 && <PlantFilters products={products.data} filters={filters} category={category} />}
      {shown && products.data!.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <p className="font-bold">
            {t(category === PLANT_CATEGORY ? 'catalog.found' : 'catalog.foundProducts', { count: shown.length })}
          </p>
          {filters.active && (
            <button onClick={filters.reset} className="min-h-10 rounded-xl px-3 font-bold text-brand-600 underline hover:bg-sand-200">
              {t('catalog.resetFilters')}
            </button>
          )}
          {/* «Лише в наявності» — сховати рослини, яких зараз немає (за замовчуванням вони просто йдуть у кінці) */}
          <label className="ml-auto inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl px-2 text-sm font-bold text-sand-700 hover:bg-sand-200">
            <input
              type="checkbox"
              checked={filters.inStock}
              onChange={(e) => filters.setInStock(e.target.checked)}
              className="h-5 w-5 accent-brand-600"
            />
            {t('catalog.inStockOnly')}
          </label>
          <label className="flex items-center gap-2 text-sm font-bold text-sand-700">
            {t('catalog.sort')}
            <Select compact value={filters.sort} onChange={(e) => filters.setSort(e.target.value as SortOrder)}>
              {SORTS.filter((s) => isSeller || !SELLER_SORTS.includes(s)).map((s) => (
                <option key={s} value={s}>
                  {t(`catalog.sorts.${s}`)}
                </option>
              ))}
            </Select>
          </label>
        </div>
      )}
      {shown && shown.length === 0 && products.data!.length > 0 && <p className="text-sand-700">{t('catalog.noMatches')}</p>}
      {/* Продавцю — «Вибрати» (масові дії) і «Додати»; своє сортування (за фото) — без поділу на групи */}
      {shown && <ProductGrid products={shown} sellerTools={{ category }} keepOrder={SELLER_SORTS.includes(filters.sort)} />}
    </div>
  )
}

const BACK = 'group inline-flex min-h-11 items-center gap-1.5 font-bold text-brand-600 hover:underline'

export function ProductPage() {
  const { t } = useTranslation()
  const lang = useLang()
  const { slug = '' } = useParams()
  const isSeller = useAuth((s) => s.role === 'seller')
  // Продавець відкриває й приховані товари (напр. з пошуку) — покупцям вони «не знайдено».
  const { data: product, isLoading, isError } = useProduct(slug, isSeller)
  const { isVisible, nameOf } = useCategories()
  const navigate = useNavigate()
  const here = useHere()

  if (isLoading || isError) return <Status isLoading={isLoading} isError={isError} />
  // Товар прибрали чи приховали (напр. посилання збережене раніше) — пропонуємо, куди піти далі.
  if (!product || (!isSeller && !isVisible(product.category))) {
    return (
      <div className="py-8 text-center">
        <PageTitle>{t('product.notFound')}</PageTitle>
        <p className="-mt-2 text-sand-700">{t('product.notFoundHint')}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link to="/c/plants" className="rounded-xl bg-brand-600 px-6 py-3.5 font-bold text-sand-50 hover:bg-brand-700">
            {t('home.toCatalog')}
          </Link>
          <Link to="/search" className="rounded-xl bg-sand-200 px-6 py-3.5 font-bold hover:bg-sand-300">
            {t('search.title')}
          </Link>
        </div>
      </div>
    )
  }

  const name = pick(product.name, lang)

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        {/* Прийшли з пошуку, каталогу з фільтрами тощо — «Назад» повертає саме туди (з тим самим запитом).
            Відкрили сторінку напряму — ведемо в каталог її категорії. */}
        {canGoBack() ? (
          <button type="button" onClick={() => navigate(-1)} className={BACK}>
            <ArrowLeft {...ICON} className="transition-transform group-hover:-translate-x-1" />
            {t('admin.back')}
          </button>
        ) : (
          <Link to={`/c/${product.category}`} className={BACK}>
            <ArrowLeft {...ICON} className="transition-transform group-hover:-translate-x-1" />
            {t('product.backShort')}
          </Link>
        )}
        {/* Продавець бачить товар як покупець, але може одразу перейти до редагування */}
        {isSeller && (
          <Link
            to={`/admin/products/${product.id}`}
            state={{ from: here }}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-600 px-4 font-bold text-sand-50 transition-transform hover:bg-brand-700 active:scale-[0.97]"
          >
            <Pencil {...ICON} />
            {t('admin.edit')}
          </Link>
        )}
      </div>
      {!product.isActive && (
        <p className="mt-4 flex items-center gap-2 rounded-xl bg-sand-200 px-4 py-3 font-bold text-sand-800">
          <EyeOff {...ICON} />
          {t('product.hiddenNotice')}
        </p>
      )}
      <div className="mt-5 grid gap-8 md:grid-cols-2">
        <ProductGallery images={product.images} alt={name} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-block rounded-full bg-sand-200 px-4 py-1.5 text-sm font-bold">{nameOf(product.category)}</span>
            {product.genus && (
              <Link
                to={`/c/${product.category}?genus=${encodeURIComponent(product.genus)}`}
                className="rounded-full border-2 border-sand-200 px-4 py-1 text-sm font-bold italic hover:border-brand-500"
              >
                {product.genus}
              </Link>
            )}
          </div>
          <h1 className="mt-4 font-display text-4xl leading-tight font-extrabold text-brand-600 sm:text-5xl">{name}</h1>
          <TagBadges tags={product.tags} className="mt-3" />
          {product.aliases && product.aliases.length > 0 && (
            <p className="mt-3 text-sand-700">
              <span className="font-bold">{t('search.aliases')}:</span> {product.aliases.join(', ')}
            </p>
          )}
          <ParentsLinks
            parents={product.parents}
            origin={product.origin}
            habitat={product.habitat}
            breeder={product.breeder}
            label
            className="mt-4"
          />
          <p className="mt-4 font-display text-3xl font-extrabold text-sunset-600">{formatPrice(product.price, lang)}</p>
          <p className="mt-1 text-sm text-sand-700">
            {product.stock > 0 ? t('product.inStock', { count: product.stock }) : t('product.outOfStock')}
          </p>
          {/* Живець: покупець має знати, що отримає одну маленьку розетку, а не те, що може здатися з фото */}
          {product.tags?.includes('cutting') && (
            <p className="mt-4 flex gap-2.5 rounded-2xl border-2 border-sunset-500/40 bg-sunset-100/60 p-4 text-sm leading-relaxed">
              <Info size={18} strokeWidth={2.25} className="mt-0.5 shrink-0 text-sunset-600" aria-hidden />
              <span>
                <strong>{t('product.cuttingTitle')}</strong> {t('product.cuttingNote')}
              </span>
            </p>
          )}
          {/* Кошик — для покупця (продавець редагує товар кнопкою вгорі); улюблене — для всіх, продавцю ще й з кількістю лайків */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            {!isSeller && <AddToCart product={product} size="lg" />}
            <FavoriteButton product={product} variant="lg" />
          </div>
          <p className="mt-8 leading-relaxed whitespace-pre-line">{pick(product.description, lang)}</p>
          {product.specs && product.specs.length > 0 && (
            <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border-2 border-sand-200 bg-sand-200 text-sm">
              {product.specs.map((spec, i) => (
                <div key={i} className="contents">
                  <dt className="bg-sand-50 px-4 py-3 text-sand-700">{pick(spec.label, lang)}</dt>
                  <dd className="bg-sand-50 px-4 py-3 font-medium">{pick(spec.value, lang)}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>
      {/* Батьки, «діти», інші форми й рослини зі спільним батьком — ті, що є в наявності */}
      <RelatedPlants product={product} />
    </div>
  )
}
