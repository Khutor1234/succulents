import { EyeOff, Pencil, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useLang } from '../../i18n'
import { formatPrice, pick } from '../../lib/format'
import { withCuttingMark } from '../../lib/plantName'
import { searchProducts } from '../../lib/search'
import type { Product } from '../../lib/types'
import { useHere } from '../../shared/navigation'
import { Select, SmallImage, SucculentIcon } from '../../shared/ui'
import { useProgressive } from '../../shared/useProgressive'
import { useCategories } from '../catalog/categories'
import { CopyName, DeleteButton, ForSaleButton, HomePin, SellerStock, VisibilityButton } from '../catalog/ProductCard'
import { useAllProducts } from './api'

type Sort = 'name' | 'new' | 'stock'
const SORTS: Sort[] = ['name', 'new', 'stock']
const byName = (a: Product, b: Product) => a.name.uk.replace(/['‘’"«»]/g, '').localeCompare(b.name.uk.replace(/['‘’"«»]/g, ''), 'uk')
const COMPARE: Record<Sort, (a: Product, b: Product) => number> = {
  name: byName,
  new: (a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0) || byName(a, b),
  stock: (a, b) => b.stock - a.stock || byName(a, b),
}

/**
 * Товари списком (лише продавець, плитка «Каталог» в адмінці): вузькі рядки — мала фотка, назва, ціна, кількість «− N +»
 * і ті самі швидкі кнопки, що й на картках у магазині. Щоб на екран влазило багато товарів одразу.
 */
export function ProductListPage() {
  const { t } = useTranslation()
  const { data, isLoading, isError } = useAllProducts()
  const { all: categories, nameOf } = useCategories()
  const [category, setCategory] = useState('')
  const [query, setQuery] = useState('')
  const [inStock, setInStock] = useState(false)
  const [sort, setSort] = useState<Sort>('name')

  const shown = useMemo(() => {
    const list = (data ?? []).filter((p) => (!category || p.category === category) && (!inStock || p.stock > 0))
    if (query.trim()) return searchProducts(list, query, { categoryName: nameOf, tagLabel: (tag) => t(`tags.${tag}`) })
    return list.sort(COMPARE[sort])
  }, [data, category, inStock, query, sort, nameOf, t])
  const { visible, sentinel } = useProgressive(shown, 60, `${category}|${inStock}|${query}|${sort}`)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto font-display text-3xl font-extrabold text-brand-600">{t('admin.list.title')}</h1>
        <Link
          to={category ? `/admin/products/new?category=${category}` : '/admin/products/new'}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-brand-600 px-4 font-bold text-sand-50 transition-colors hover:bg-brand-700"
        >
          <Plus size={18} strokeWidth={2.5} aria-hidden />
          {t('admin.addProduct')}
        </Link>
      </div>

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
        <Select compact value={category} onChange={(e) => setCategory(e.target.value)} aria-label={t('admin.list.category')}>
          <option value="">{t('admin.list.allCategories')}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        {/* Під час пошуку порядок — за тим, наскільки збігається запит */}
        <Select compact value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label={t('catalog.sort')} disabled={!!query.trim()}>
          {SORTS.map((s) => (
            <option key={s} value={s}>
              {t(`admin.list.sorts.${s}`)}
            </option>
          ))}
        </Select>
        <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl px-2 text-sm font-bold text-sand-700 hover:bg-sand-200">
          <input type="checkbox" checked={inStock} onChange={(e) => setInStock(e.target.checked)} className="h-5 w-5 accent-brand-600" />
          {t('catalog.inStockOnly')}
        </label>
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
              <SmallImage src={product.images[0]} alt="" className="h-10 w-10 rounded-lg object-cover" />
              <span className="pointer-events-none absolute top-1/2 left-12 z-30 hidden w-72 -translate-y-1/2 overflow-hidden rounded-2xl border-4 border-sand-50 bg-sand-50 shadow-2xl group-hover/photo:block">
                <SmallImage src={product.images[0]} alt="" className="block aspect-square w-full object-cover" />
              </span>
            </span>
          ) : (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sand-200 text-brand-600">
              <SucculentIcon className="w-6" />
            </span>
          )}
          <span className="min-w-0">
            <span className="block truncate font-bold hover:text-brand-600">
              {withCuttingMark(name, product.tags?.includes('cutting'), t('product.cuttingMark'))}
            </span>
            <span className="flex items-center gap-2 text-xs text-sand-700">
              <span className="font-display font-extrabold text-sunset-600">{formatPrice(product.price, lang)}</span>
              {!product.isActive && (
                <span className="inline-flex items-center gap-1 font-bold text-lavender-700">
                  <EyeOff size={12} strokeWidth={2.75} aria-hidden />
                  {t('product.hidden')}
                </span>
              )}
            </span>
          </span>
        </Link>
      </div>
      <div className="flex items-center gap-1">
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
        <DeleteButton product={product} name={name} compact />
      </div>
    </li>
  )
}
