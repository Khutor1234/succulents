import { Eye, EyeOff, Pencil, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { imageUrl } from '../../firebase/config'
import { useLang } from '../../i18n'
import { formatPrice, pick } from '../../lib/format'
import { PLANT_CATEGORY } from '../../lib/plants'
import { ICON } from '../../shared/icon'
import { SucculentIcon } from '../../shared/ui'
import { TagBadges } from '../catalog/PlantFilters'
import { useCategories } from '../catalog/categories'
import { useAllProducts, useToggleProductActive } from './api'

const ALL = 'all'

export function ProductsPage() {
  const { t } = useTranslation()
  const lang = useLang()
  const { data: products, isLoading, isError } = useAllProducts()
  const toggle = useToggleProductActive()
  const { nameOf, all: categories } = useCategories()
  // Вибрана категорія зберігається в адресі (?category=soil) — після редагування товару повертаємось туди ж.
  const [params, setParams] = useSearchParams()
  // Без параметра одразу відкриваються «Рослини» — їх редагують найчастіше; «Усі» — це ?category=all.
  const param = params.get('category') ?? PLANT_CATEGORY
  const category = param === ALL ? '' : param
  const selectCategory = (id: string) => setParams({ category: id || ALL }, { replace: true })

  const countBy = (id: string) => products?.filter((p) => p.category === id).length ?? 0
  const shown = category ? products?.filter((p) => p.category === category) : products

  const chip = (on: boolean) =>
    `inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border-2 py-1.5 pr-1.5 pl-4 text-sm font-bold whitespace-nowrap transition-colors ${
      on ? 'border-brand-600 bg-brand-600 text-sand-50' : 'border-sand-200 bg-sand-50 text-ink hover:border-brand-500'
    }`
  const count = (n: number, on: boolean) => (
    <span
      className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[11px] tabular-nums ${on ? 'bg-brand-700 text-sand-100' : 'bg-sand-200 text-sand-700'}`}
    >
      {n}
    </span>
  )

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-extrabold text-brand-600">{t('admin.products')}</h1>
        <Link
          to={category ? `/admin/products/new?category=${category}` : '/admin/products/new'}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-600 px-4 font-bold text-sand-50 transition-transform hover:bg-brand-700 active:scale-[0.97]"
        >
          <Plus {...ICON} />
          {t('admin.addProduct')}
        </Link>
      </div>

      {products && products.length > 0 && (
        // На телефоні — один рядок, що гортається вбік; на широкому екрані — переноситься
        <div
          className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
          role="group"
          aria-label={t('admin.fields.category')}
        >
          <button onClick={() => selectCategory('')} className={chip(!category)} aria-pressed={!category}>
            {t('admin.order.filterAll')}
            {count(products.length, !category)}
          </button>
          {categories.map((c) => {
            const on = category === c.id
            return (
              <button key={c.id} onClick={() => selectCategory(c.id)} className={chip(on)} aria-pressed={on}>
                <span className={c.visible ? '' : 'line-through opacity-70'}>{c.name}</span>
                {count(countBy(c.id), on)}
              </button>
            )
          })}
        </div>
      )}

      {isLoading && <p className="text-sand-700">{t('loading')}</p>}
      {isError && <p className="text-red-700">{t('errors.loading')}</p>}
      {products?.length === 0 && <p className="text-sand-700">{t('admin.noProducts')}</p>}
      {shown && shown.length === 0 && products!.length > 0 && <p className="text-sand-700">{t('catalog.empty')}</p>}

      {shown && shown.length > 0 && (
        <ul className="space-y-3">
          {shown.map((p, i) => (
            <li
              key={p.id}
              style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}
              className={`grid animate-rise grid-cols-[64px_minmax(0,1fr)] items-center gap-x-3 gap-y-3 rounded-3xl border-2 bg-sand-50 p-3 sm:grid-cols-[72px_minmax(0,1fr)_auto_auto] sm:gap-x-4 ${
                p.isActive ? 'border-sand-200' : 'border-dashed border-sand-300 bg-sand-100'
              }`}
            >
              <Link to={`/admin/products/${p.id}`} className={p.isActive ? '' : 'opacity-60'}>
                {p.images[0] ? (
                  <img src={imageUrl(p.images[0])} alt="" className="aspect-square w-full rounded-2xl object-cover" />
                ) : (
                  <div className="flex aspect-square w-full items-center justify-center rounded-2xl bg-sand-200 text-brand-600">
                    <SucculentIcon className="w-9" />
                  </div>
                )}
              </Link>

              <div className="min-w-0">
                <Link
                  to={`/admin/products/${p.id}`}
                  className={`line-clamp-2 leading-snug font-bold hover:text-brand-600 ${p.isActive ? '' : 'text-sand-700'}`}
                >
                  {pick(p.name, lang)}
                </Link>
                <p className="mt-0.5 text-sm text-sand-700">
                  {nameOf(p.category)}
                  {!p.isActive && <span className="ml-2 font-bold">· {t('admin.hidden')}</span>}
                </p>
                <TagBadges tags={p.tags} className="mt-1.5" />
              </div>

              {/* Ціна й залишок — на телефоні окремим рядком під назвою */}
              <div className="col-span-2 flex items-baseline justify-between gap-4 sm:col-span-1 sm:block sm:text-right">
                <p className="font-display text-lg font-extrabold whitespace-nowrap text-sunset-600">{formatPrice(p.price, lang)}</p>
                <p className={`text-sm whitespace-nowrap ${p.stock === 0 ? 'font-bold text-red-700' : 'text-sand-700'}`}>
                  {p.stock === 0 ? t('product.outOfStock') : t('admin.inStockShort', { count: p.stock })}
                </p>
              </div>

              <div className="col-span-2 grid grid-cols-2 gap-2 sm:col-span-1 sm:flex">
                <Link
                  to={`/admin/products/${p.id}`}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 font-bold text-sand-50 transition-transform hover:bg-brand-700 active:scale-[0.97]"
                >
                  <Pencil {...ICON} />
                  {t('admin.edit')}
                </Link>
                <button
                  disabled={toggle.isPending}
                  onClick={() => toggle.mutate({ id: p.id, isActive: !p.isActive })}
                  className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 font-bold transition-transform active:scale-[0.97] disabled:opacity-50 ${
                    p.isActive ? 'bg-sand-200 text-ink hover:bg-sand-300' : 'bg-sunset-600 text-sand-50 hover:bg-sunset-700'
                  }`}
                >
                  {p.isActive ? <EyeOff {...ICON} /> : <Eye {...ICON} />}
                  {p.isActive ? t('admin.hide') : t('admin.show')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
