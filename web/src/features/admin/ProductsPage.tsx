import { Copy, Eye, FileSpreadsheet, EyeOff, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { imageUrl } from '../../firebase/config'
import { useLang } from '../../i18n'
import { formatPrice, pick } from '../../lib/format'
import { PLANT_CATEGORY } from '../../lib/plants'
import { searchProducts } from '../../lib/search'
import type { Product } from '../../lib/types'
import { ICON } from '../../shared/icon'
import { SucculentIcon } from '../../shared/ui'
import { useProgressive } from '../../shared/useProgressive'
import { TagBadges } from '../catalog/PlantFilters'
import { useCategories } from '../catalog/categories'
import { useAllProducts, useDeleteProduct, useToggleProductActive } from './api'

const ALL = 'all'
// Скільки товарів показуємо за раз (решта — коли догортали донизу)
const PAGE = 30

const SORTS = ['shownFirst', 'name', 'hiddenFirst', 'stock', 'priceAsc', 'priceDesc', 'new'] as const
type Sort = (typeof SORTS)[number]
// Без вибору — спершу показані на сайті (всередині за назвою)
const DEFAULT_SORT: Sort = 'shownFirst'

/** Порядок списку. «new» — як прийшло з бази (найновіші спершу). */
function sortProducts(list: Product[], sort: Sort, nameOf: (p: Product) => string): Product[] {
  const byName = (a: Product, b: Product) => nameOf(a).localeCompare(nameOf(b), 'uk')
  switch (sort) {
    case 'name':
      return [...list].sort(byName)
    // Спершу показані на сайті (або спершу приховані), всередині — за назвою
    case 'shownFirst':
      return [...list].sort((a, b) => Number(b.isActive) - Number(a.isActive) || byName(a, b))
    case 'hiddenFirst':
      return [...list].sort((a, b) => Number(a.isActive) - Number(b.isActive) || byName(a, b))
    // Спершу ті, яких на складі найбільше; закінчені — в кінці
    case 'stock':
      return [...list].sort((a, b) => b.stock - a.stock || byName(a, b))
    case 'priceAsc':
      return [...list].sort((a, b) => a.price - b.price || byName(a, b))
    case 'priceDesc':
      return [...list].sort((a, b) => b.price - a.price || byName(a, b))
    default:
      return list
  }
}

export function ProductsPage() {
  const { t } = useTranslation()
  const lang = useLang()
  const { data: products, isLoading, isError } = useAllProducts()
  const toggle = useToggleProductActive()
  const remove = useDeleteProduct()
  const { nameOf, all: categories } = useCategories()
  // Вибрана категорія зберігається в адресі (?category=soil) — після редагування товару повертаємось туди ж.
  const [params, setParams] = useSearchParams()
  // Без параметра одразу відкриваються «Рослини» — їх редагують найчастіше; «Усі» — це ?category=all.
  const param = params.get('category') ?? PLANT_CATEGORY
  const category = param === ALL ? '' : param
  // Сортування й пошук теж в адресі (?sort=stock&q=lola) — щоб після редагування повернутись до того ж списку.
  const sortParam = params.get('sort') as Sort | null
  const sort: Sort = sortParam && SORTS.includes(sortParam) ? sortParam : DEFAULT_SORT
  const query = params.get('q') ?? ''
  const update = (changes: Record<string, string>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    setParams(next, { replace: true })
  }
  const selectCategory = (id: string) => update({ category: id || ALL })
  // Поле пошуку оновлюємо одразу, а список — коли людина на мить зупинилась
  const [typed, setTyped] = useState(query)
  useEffect(() => {
    if (typed.trim() === query) return
    const timer = setTimeout(() => update({ q: typed.trim() }), 250)
    return () => clearTimeout(timer)
  })

  const countBy = (id: string) => products?.filter((p) => p.category === id).length ?? 0
  const shown = useMemo(() => {
    if (!products) return undefined
    const inCategory = category ? products.filter((p) => p.category === category) : products
    const found = query ? searchProducts(inCategory, query, { categoryName: nameOf, tagLabel: (tag) => t(`tags.${tag}`) }) : inCategory
    return sortProducts(found, sort, (p) => pick(p.name, lang))
    // nameOf і t створюються наново щоразу — від них не залежимо
  }, [products, category, query, sort, lang])
  const list = useProgressive(shown ?? [], PAGE, `${category}|${query}|${sort}`)

  // Абетка — коли список за назвою: перший товар кожної літери отримує якір, до якого прокручує кнопка.
  // «Спершу показані» теж за назвою всередині — абетка веде до літери серед показаних
  const byName = sort === 'name' || sort === 'shownFirst'
  const letterOf = (name: string) => name.trim().charAt(0).toLocaleUpperCase('uk')
  const firstOfLetter = new Map<string, { id: string; index: number }>()
  if (byName)
    (shown ?? []).forEach((p, index) => {
      const letter = letterOf(pick(p.name, lang))
      if (letter && !firstOfLetter.has(letter)) firstOfLetter.set(letter, { id: p.id, index })
    })
  // Літера може бути ще не показана (товари вантажаться порціями) — спершу показуємо до неї, потім прокручуємо.
  const [jumping, setJumping] = useState<string | null>(null)
  const jumpTo = (letter: string) => {
    list.showAtLeast((firstOfLetter.get(letter)?.index ?? 0) + PAGE)
    setJumping(letter)
  }
  useEffect(() => {
    if (!jumping) return
    document.getElementById(`letter-${jumping}`)?.scrollIntoView({ block: 'start' })
    setJumping(null)
  }, [jumping, list.visible.length])

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
          to="/admin/import"
          className="ml-auto inline-flex min-h-11 items-center gap-2 rounded-xl bg-sand-200 px-4 font-bold text-ink transition-transform hover:bg-sand-300 active:scale-[0.97]"
        >
          <FileSpreadsheet {...ICON} />
          <span className="hidden sm:inline">{t('admin.importFromSheet')}</span>
        </Link>
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

      {products && products.length > 0 && (
        <div className="mb-4 flex flex-col gap-2 sm:flex-row">
          <label className="relative flex-1">
            <span className="sr-only">{t('admin.searchLabel')}</span>
            <Search size={18} strokeWidth={2.25} aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-sand-700" />
            <input
              type="search"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={t('admin.searchPlaceholder')}
              className="min-h-12 w-full rounded-xl border-2 border-sand-200 bg-sand-50 pr-11 pl-10 font-semibold outline-none placeholder:font-normal placeholder:text-sand-700 focus:border-brand-500 [&::-webkit-search-cancel-button]:hidden"
            />
            {typed && (
              <button
                type="button"
                onClick={() => {
                  setTyped('')
                  update({ q: '' })
                }}
                aria-label={t('admin.searchClear')}
                className="absolute top-1/2 right-1.5 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-sand-700 hover:bg-sand-200"
              >
                <X size={16} strokeWidth={2.4} aria-hidden />
              </button>
            )}
          </label>
          <label className="flex items-center gap-2 text-sm font-bold sm:w-72">
            <span className="shrink-0 text-sand-700">{t('admin.sort.label')}</span>
            <select
              value={sort}
              onChange={(e) => update({ sort: e.target.value === DEFAULT_SORT ? '' : e.target.value })}
              className="min-h-12 w-full rounded-xl border-2 border-sand-200 bg-sand-50 px-3 font-bold outline-none focus:border-brand-500"
            >
              {SORTS.map((s) => (
                <option key={s} value={s}>
                  {t(`admin.sort.${s}`)}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {isLoading && <p className="text-sand-700">{t('loading')}</p>}
      {isError && <p className="text-red-700">{t('errors.loading')}</p>}
      {products?.length === 0 && <p className="text-sand-700">{t('admin.noProducts')}</p>}
      {shown && shown.length === 0 && products!.length > 0 && (
        <p className="text-sand-700">{query ? t('admin.searchEmpty', { query }) : t('catalog.empty')}</p>
      )}
      {query && shown && shown.length > 0 && <p className="mb-3 text-sm text-sand-700">{t('admin.searchFound', { count: shown.length })}</p>}

      {/* Абетка (коли список за назвою): прикріплена під шапкою, лише літери, на які є товари; натиснули — список прокрутився */}
      {byName && firstOfLetter.size > 1 && (
        <nav
          aria-label={t('admin.alphabet')}
          className="sticky top-[var(--header-h,0px)] z-20 -mx-4 mb-3 flex gap-1 overflow-x-auto border-b border-sand-200 bg-sand-100/95 px-4 py-2 backdrop-blur sm:mx-0 sm:flex-wrap sm:rounded-2xl sm:border sm:px-2"
        >
          {[...firstOfLetter.keys()].map((letter) => (
            <button
              key={letter}
              type="button"
              onClick={() => jumpTo(letter)}
              className="flex h-10 min-w-10 shrink-0 items-center justify-center rounded-xl bg-sand-50 font-display text-lg font-extrabold text-brand-600 transition-colors hover:bg-brand-600 hover:text-sand-50 active:scale-95"
            >
              {letter}
            </button>
          ))}
        </nav>
      )}

      {shown && shown.length > 0 && (
        <ul className="space-y-3">
          {list.visible.map((p, i) => (
            <li
              key={p.id}
              id={byName && firstOfLetter.get(letterOf(pick(p.name, lang)))?.id === p.id ? `letter-${letterOf(pick(p.name, lang))}` : undefined}
              style={{ animationDelay: `${Math.min(i % PAGE, 10) * 30}ms` }}
              className={`grid animate-rise scroll-mt-[5.5rem] grid-cols-[64px_minmax(0,1fr)] items-center gap-x-3 gap-y-3 rounded-3xl border-2 bg-sand-50 p-3 sm:grid-cols-[72px_minmax(0,1fr)_auto_auto] sm:gap-x-4 ${
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
              <div className="col-span-2 flex items-baseline justify-between gap-4 sm:col-span-1 sm:block sm:w-36 sm:text-right">
                <p className="font-display text-lg font-extrabold whitespace-nowrap text-sunset-600">{formatPrice(p.price, lang)}</p>
                <p className={`text-sm whitespace-nowrap ${p.stock === 0 ? 'font-bold text-red-700' : 'text-sand-700'}`}>
                  {p.stock === 0 ? t('product.outOfStock') : t('admin.inStockShort', { count: p.stock })}
                </p>
              </div>

              {/* На телефоні — два рядки по дві кнопки; на комп’ютері — в один рядок, копія й видалення значками */}
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
                  onClick={() => toggle.mutate({ id: p.id, isActive: !p.isActive, stock: p.stock })}
                  className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 font-bold transition-transform active:scale-[0.97] disabled:opacity-50 sm:w-40 ${
                    p.isActive ? 'bg-sand-200 text-ink hover:bg-sand-300' : 'bg-sunset-600 text-sand-50 hover:bg-sunset-700'
                  }`}
                >
                  {p.isActive ? <EyeOff {...ICON} /> : <Eye {...ICON} />}
                  {p.isActive ? t('admin.hide') : t('admin.show')}
                </button>
                {/* Копія — новий товар з тими самими даними (напр., для варієгатної форми) */}
                <Link
                  to={`/admin/products/new?copy=${p.id}`}
                  aria-label={t('admin.copyNamed', { name: pick(p.name, lang) })}
                  title={t('admin.copy')}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border-2 border-brand-600/40 px-3 text-sm font-bold text-brand-600 sm:min-h-12 sm:w-12 sm:px-0 transition-colors hover:border-brand-600 hover:bg-brand-600 hover:text-sand-50 active:scale-[0.97]"
                >
                  <Copy {...ICON} />
                  <span className="sm:hidden">{t('admin.copyShort')}</span>
                </Link>
                {/* Видалення назавжди — з підтвердженням */}
                <button
                  type="button"
                  disabled={remove.isPending}
                  onClick={() => window.confirm(t('admin.deleteProductConfirm', { name: pick(p.name, lang) })) && remove.mutate(p.id)}
                  aria-label={t('admin.deleteNamed', { name: pick(p.name, lang) })}
                  title={t('admin.deleteProduct')}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border-2 border-red-700/40 px-3 text-sm font-bold text-red-700 sm:min-h-12 sm:w-12 sm:px-0 transition-colors hover:border-red-700 hover:bg-red-700 hover:text-white active:scale-[0.97] disabled:opacity-50"
                >
                  <Trash2 {...ICON} />
                  <span className="sm:hidden">{t('admin.deleteShort')}</span>
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {list.sentinel}
    </div>
  )
}
