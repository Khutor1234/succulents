import { EyeOff, List, Pencil, Plus, Tags } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useLang } from '../../i18n'
import { pick } from '../../lib/format'
import { withCuttingMark } from '../../lib/plantName'
import { PLANT_CATEGORY } from '../../lib/plants'
import { searchProducts } from '../../lib/search'
import type { Product } from '../../lib/types'
import { useHere } from '../../shared/navigation'
import { Select, SmallImage, SucculentIcon } from '../../shared/ui'
import { useProgressive } from '../../shared/useProgressive'
import { useCategories } from '../catalog/categories'
import { CopyName, CuttingToggle, DeleteButton, ForSaleButton, HomePin, SellerStock, VerifiedToggle, VisibilityButton } from '../catalog/ProductCard'
import { ORIGINS, originOf } from '../catalog/usePlantFilters'
import { useAllProducts, useSetPrice } from './api'
import { CategoriesPage } from './CategoriesPage'
import { TabBar, useTab } from './TabBar'

const TABS = ['list', 'categories'] as const
const TAB_ICONS = { list: List, categories: Tags }

/** Фільтр «Показати»: усі, лише в наявності, у продажу, не продаються, видимі покупцям, приховані. */
const SHOWS = ['all', 'inStock', 'outOfStock', 'withPhoto', 'noPhoto', 'forSale', 'notForSale', 'visible', 'hidden', 'onHome', 'cutting', 'verified', 'unverified'] as const
type Show = (typeof SHOWS)[number]
// «У продажу» — як зафарбована іконка-цінник: позначено «у продажу» і покупцю справді є що купити (не 0)
const sellable = (p: Product) => p.forSale !== false && p.stock > 0
const SHOW_TEST: Record<Show, (p: Product) => boolean> = {
  all: () => true,
  inStock: (p) => p.stock > 0,
  outOfStock: (p) => p.stock <= 0,
  withPhoto: (p) => (p.images?.length ?? 0) > 0,
  noPhoto: (p) => !p.images?.length,
  forSale: sellable,
  notForSale: (p) => !sellable(p),
  visible: (p) => p.isActive,
  hidden: (p) => !p.isActive,
  onHome: (p) => !!p.onHome,
  cutting: (p) => !!p.tags?.includes('cutting'),
  verified: (p) => !!p.verified,
  unverified: (p) => !p.verified,
}

type Sort = 'name' | 'new' | 'old' | 'priceDesc' | 'priceAsc' | 'stock'
const SORTS: Sort[] = ['name', 'new', 'old', 'priceDesc', 'priceAsc', 'stock']
const byName = (a: Product, b: Product) => a.name.uk.replace(/['‘’"«»]/g, '').localeCompare(b.name.uk.replace(/['‘’"«»]/g, ''), 'uk')
const COMPARE: Record<Sort, (a: Product, b: Product) => number> = {
  name: byName,
  new: (a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0) || byName(a, b),
  old: (a, b) => (a.createdAt?.toMillis() ?? 0) - (b.createdAt?.toMillis() ?? 0) || byName(a, b),
  priceDesc: (a, b) => b.price - a.price || byName(a, b),
  priceAsc: (a, b) => a.price - b.price || byName(a, b),
  stock: (a, b) => b.stock - a.stock || byName(a, b),
}

/**
 * Товари списком (лише продавець, плитка «Каталог» в адмінці): вузькі рядки — мала фотка, назва, ціна, кількість «− N +»
 * і ті самі швидкі кнопки, що й на картках у магазині. Щоб на екран влазило багато товарів одразу.
 * Друга вкладка — «Категорії» (?tab=categories, CategoriesPage.tsx): які категорії видно в меню магазину.
 */
export function ProductListPage() {
  const { t } = useTranslation()
  const [tab, setTab] = useTab(TABS)
  const { data, isLoading, isError } = useAllProducts()
  const { all: categories, nameOf } = useCategories()
  const [query, setQuery] = useState('')
  // Один фільтр «Показати»: стан товару, далі походження (origin:…) і в самому кінці категорії (cat:…)
  const [filter, setFilter] = useState('all')
  const show: Show = (SHOWS as readonly string[]).includes(filter) ? (filter as Show) : 'all'
  const origin = filter.startsWith('origin:') ? filter.slice(7) : ''
  const category = filter.startsWith('cat:') ? filter.slice(4) : ''
  const [sort, setSort] = useState<Sort>('name')

  const shown = useMemo(() => {
    const list = (data ?? []).filter((p) => (!category || p.category === category) && (!origin || originOf(p) === origin) && SHOW_TEST[show](p))
    if (query.trim()) return searchProducts(list, query, { categoryName: nameOf, tagLabel: (tag) => t(`tags.${tag}`) })
    return list.sort(COMPARE[sort])
  }, [data, category, origin, show, query, sort, nameOf, t])
  const { visible, sentinel } = useProgressive(shown, 60, `${filter}|${query}|${sort}`)

  return (
    <div className="space-y-4">
      <h1 className="sr-only">{t('admin.list.title')}</h1>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TabBar
          label={t('admin.list.title')}
          active={tab}
          onChange={setTab}
          tabs={TABS.map((id) => ({ id, label: t(`admin.list.tabs.${id}`), Icon: TAB_ICONS[id] }))}
        />
        <Link
          to={category ? `/admin/products/new?category=${category}` : '/admin/products/new'}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-brand-600 px-4 font-bold text-sand-50 transition-colors hover:bg-brand-700"
        >
          <Plus size={18} strokeWidth={2.5} aria-hidden />
          {t('admin.addProduct')}
        </Link>
      </div>

      {tab === 'categories' ? (
        <CategoriesPage />
      ) : (
        <>
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          enterKeyHint="search"
          placeholder={t('admin.list.search')}
          aria-label={t('admin.list.search')}
          className="min-w-0 flex-1 basis-56 rounded-xl border-2 border-sand-200 bg-sand-50 px-3.5 py-2 focus:border-brand-500 focus:outline-none"
        />
        {/* Під час пошуку порядок — за тим, наскільки збігається запит */}
        <Select compact value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label={t('catalog.sort')} disabled={!!query.trim()}>
          {SORTS.map((s) => (
            <option key={s} value={s}>
              {t(`admin.list.sorts.${s}`)}
            </option>
          ))}
        </Select>
        <Select compact value={filter} onChange={(e) => setFilter(e.target.value)} aria-label={t('admin.list.show')}>
          {SHOWS.map((s) => (
            <option key={s} value={s}>
              {t(`admin.list.shows.${s}`)}
            </option>
          ))}
          <optgroup label={t('catalog.origin')}>
            {ORIGINS.map((o) => (
              <option key={o} value={`origin:${o}`}>
                {t(`admin.fields.origins.${o}`)}
              </option>
            ))}
          </optgroup>
          <optgroup label={t('admin.list.category')}>
            {categories.map((c) => (
              <option key={c.id} value={`cat:${c.id}`}>
                {c.name}
              </option>
            ))}
          </optgroup>
        </Select>
      </div>

      {isLoading && <p className="text-sand-700">{t('loading')}</p>}
      {isError && <p className="text-red-700">{t('errors.loading')}</p>}
      {data && <p className="text-sm font-bold text-sand-700">{t('admin.list.count', { count: shown.length })}</p>}

      {/* Без overflow-hidden: збільшене фото при наведенні має виходити за межі списку */}
      <ul className="divide-y-2 divide-sand-200 rounded-2xl border-2 border-sand-200 bg-sand-50">
        {visible.map((p) => (
          <Row key={p.id} product={p} />
        ))}
      </ul>
      {sentinel}
        </>
      )}
    </div>
  )
}

function Row({ product }: { product: Product }) {
  const { t } = useTranslation()
  const lang = useLang()
  const name = pick(product.name, lang)
  const here = useHere()
  return (
    // На широкому екрані — один рядок; на телефоні кнопки переносяться під назву. Прихований — лавандовим фоном
    <li className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 px-2.5 py-1.5 first:rounded-t-2xl last:rounded-b-2xl ${product.isActive ? '' : 'bg-lavender-50'}`}>
      <div className="flex min-w-0 flex-1 basis-60 items-center gap-1">
        {/* На початку рядка — щоб у всіх товарів була на одному місці */}
        <CopyName name={name} />
        <Link to={`/product/${product.slug}`} className="flex min-w-0 items-center gap-2.5">
          {product.images[0] ? (
            // Навели мишку на фото — поруч воно ж, але велике (щоб роздивитися рослину)
            <span className="group/photo relative shrink-0">
              <SmallImage src={product.images[0]} alt="" className="h-14 w-14 rounded-lg object-cover" />
              <span className="pointer-events-none absolute top-1/2 left-16 z-30 hidden w-72 -translate-y-1/2 overflow-hidden rounded-2xl border-4 border-sand-50 bg-sand-50 shadow-2xl group-hover/photo:block">
                <SmallImage src={product.images[0]} alt="" className="block aspect-square w-full object-cover" />
              </span>
            </span>
          ) : (
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-sand-200 text-brand-600">
              <SucculentIcon className="w-7" />
            </span>
          )}
          <span className="min-w-0">
            <span className="block truncate font-bold hover:text-brand-600">
              {withCuttingMark(name, product.tags?.includes('cutting'), t('product.cuttingMark'))}
            </span>
            {/* Інші назви — під назвою, дрібно */}
            {!!product.aliases?.length && <span className="block truncate text-xs text-sand-700">{product.aliases.join(', ')}</span>}
            {!product.isActive && (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-lavender-700">
                <EyeOff size={12} strokeWidth={2.75} aria-hidden />
                {t('product.hidden')}
              </span>
            )}
          </span>
        </Link>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <SellerPrice product={product} />
        <SellerStock product={product} compact />
        <Link
          to={`/admin/products/${product.id}`}
          state={{ from: here }}
          aria-label={t('admin.editNamed', { name })}
          title={t('admin.edit')}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-sand-50 transition-colors hover:bg-brand-700"
        >
          <Pencil size={18} strokeWidth={2.25} aria-hidden />
        </Link>
        <VisibilityButton product={product} name={name} compact />
        <ForSaleButton product={product} name={name} compact />
        <HomePin product={product} name={name} compact />
        {product.category === PLANT_CATEGORY && <CuttingToggle product={product} name={name} compact />}
        <DeleteButton product={product} name={name} compact />
        {/* «Перевірено вручну» — останньою, праворуч від усіх кнопок */}
        <VerifiedToggle product={product} className="!my-0 h-9 w-9" />
      </div>
    </li>
  )
}

/**
 * Ціна в гривнях — поле, яке можна виправити прямо в списку (як «− N +» для залишку).
 * Зберігаємо, коли вийшли з поля або натиснули Enter; Esc — повернути як було.
 */
function SellerPrice({ product }: { product: Product }) {
  const { t } = useTranslation()
  const save = useSetPrice()
  const shown = String(Math.round(product.price) / 100)
  const [value, setValue] = useState(shown)
  const [base, setBase] = useState(product.price)
  const [focused, setFocused] = useState(false)
  // Ціну змінили деінде (форма) — показуємо нову, якщо поле зараз не редагують
  if (product.price !== base && !focused && !save.isPending) {
    setBase(product.price)
    setValue(shown)
  }
  const commit = () => {
    const uah = Number(value.replace(',', '.').replace(/s/g, ''))
    if (!value.trim() || !Number.isFinite(uah) || uah < 0) return setValue(shown)
    const price = Math.round(uah * 100)
    setValue(String(price / 100))
    if (price !== product.price) {
      setBase(price)
      save.mutate({ id: product.id, price })
    }
  }
  return (
    <label className="flex h-9 items-center rounded-xl border-2 border-sand-200 bg-sand-50 pr-2.5 focus-within:border-brand-500" title={t('admin.fields.price')}>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={(e) => {
          setFocused(true)
          e.currentTarget.select()
        }}
        onBlur={() => {
          setFocused(false)
          commit()
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') {
            setValue(shown)
            requestAnimationFrame(() => e.currentTarget?.blur())
          }
        }}
        aria-label={t('admin.fields.price')}
        className="w-16 bg-transparent text-right font-display text-lg font-extrabold text-sunset-600 tabular-nums focus:outline-none"
      />
      <span className="ml-0.5 font-display text-lg font-extrabold text-sunset-600">₴</span>
    </label>
  )
}
