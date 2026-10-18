import { FileSpreadsheet, Plus, Search, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { useLang } from '../../i18n'
import { pick } from '../../lib/format'
import { PLANT_CATEGORY } from '../../lib/plants'
import { searchProducts } from '../../lib/search'
import type { Product } from '../../lib/types'
import { ICON } from '../../shared/icon'
import { useProgressive } from '../../shared/useProgressive'
import { ProductCard } from '../catalog/ProductCard'
import { useCategories } from '../catalog/categories'
import { useAllProducts } from './api'

const ALL = 'all'
// Скільки товарів показуємо за раз (решта — коли догортали донизу)
const PAGE = 30

const SORTS = ['shownFirst', 'name', 'hiddenFirst', 'photoFirst', 'noPhotoFirst', 'stock', 'priceAsc', 'priceDesc', 'new'] as const
type Sort = (typeof SORTS)[number]
// Без вибору — спершу показані на сайті (всередині за назвою)
const DEFAULT_SORT: Sort = 'shownFirst'

type Anchor = { id: string; index: number }

const LETTER =
  'flex shrink-0 items-center justify-center rounded-xl font-display font-extrabold transition-colors hover:bg-brand-600 hover:text-sand-50 active:scale-95'

// Лапки сорту не враховуємо: «Echeveria 'Lola'» стоїть між agavoides і 'Lucita', а не окремо перед усіма видами
const plain = (name: string) => name.replace(/['‘’"«»]/g, '').trim()

/** «Echeveria 'Lola' variegata» → літера E, рід Echeveria, літера сорту L. */
function splitName(name: string) {
  const [genus = '', ...rest] = plain(name).split(/\s+/)
  // Перша літера після роду (пропускаємо «×» гібридів тощо)
  const sub = rest.join(' ').match(/\p{L}/u)?.[0]?.toLocaleUpperCase('uk')
  return { letter: genus.charAt(0).toLocaleUpperCase('uk'), genus, sub }
}

/** Порядок списку. «new» — як прийшло з бази (найновіші спершу). */
function sortProducts(list: Product[], sort: Sort, nameOf: (p: Product) => string): Product[] {
  const byName = (a: Product, b: Product) => plain(nameOf(a)).localeCompare(plain(nameOf(b)), 'uk')
  switch (sort) {
    case 'name':
      return [...list].sort(byName)
    // Спершу показані на сайті (або спершу приховані), всередині — за назвою
    case 'shownFirst':
      return [...list].sort((a, b) => Number(b.isActive) - Number(a.isActive) || byName(a, b))
    case 'hiddenFirst':
      return [...list].sort((a, b) => Number(a.isActive) - Number(b.isActive) || byName(a, b))
    // Спершу з фото (або спершу без фото — щоб швидко знайти, кому ще треба сфотографувати), всередині — за назвою
    case 'photoFirst':
      return [...list].sort((a, b) => Number(b.images.length > 0) - Number(a.images.length > 0) || byName(a, b))
    case 'noPhotoFirst':
      return [...list].sort((a, b) => Number(a.images.length > 0) - Number(b.images.length > 0) || byName(a, b))
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

  // Абетка — коли список за назвою. Два рівні: перша літера (рід) і, коли її вибрали, літери сорту всередині роду
  // («Echeveria» → A, B, L… — 'Lola', 'Blue Bird'). Перший товар кожної літери отримує якір, до якого прокручує кнопка.
  // Лише для «За назвою (А–Я)»: в інших сортуваннях літери йдуть урозкид, і абетка лише плутає
  const byName = sort === 'name'
  const firstOfLetter = new Map<string, Anchor>()
  // рід → (літера сорту → перший товар); роди в порядку списку
  const firstOfSub = new Map<string, Map<string, Anchor>>()
  const anchors = new Set<string>()
  if (byName)
    (shown ?? []).forEach((p, index) => {
      const { letter, genus, sub } = splitName(pick(p.name, lang))
      if (!letter) return
      if (!firstOfLetter.has(letter)) {
        firstOfLetter.set(letter, { id: p.id, index })
        anchors.add(p.id)
      }
      const subs = firstOfSub.get(genus) ?? new Map<string, Anchor>()
      firstOfSub.set(genus, subs)
      if (sub && !subs.has(sub)) {
        subs.set(sub, { id: p.id, index })
        anchors.add(p.id)
      }
    })
  // Вибрана літера й рід — для другого ряду абетки
  const [picked, setPicked] = useState<{ letter: string; genus?: string } | null>(null)
  const pickedLetter = picked && firstOfLetter.has(picked.letter) ? picked.letter : null
  const genera = pickedLetter ? [...firstOfSub.keys()].filter((g) => g.charAt(0).toLocaleUpperCase('uk') === pickedLetter) : []
  const pickedGenus = picked?.genus && genera.includes(picked.genus) ? picked.genus : genera[0]
  const subs = pickedGenus ? firstOfSub.get(pickedGenus) : undefined
  // Літера може бути ще не показана (товари вантажаться порціями) — спершу показуємо до неї, потім прокручуємо.
  const [jumping, setJumping] = useState<string | null>(null)
  const jumpTo = (anchor: Anchor | undefined) => {
    if (!anchor) return
    list.showAtLeast(anchor.index + PAGE)
    setJumping(anchor.id)
  }
  useEffect(() => {
    if (!jumping) return
    // Прокручуємо так, щоб товар став одразу під прикріпленою абеткою (вона буває в один або два ряди)
    const el = document.getElementById(`p-${jumping}`)
    const nav = document.getElementById('alphabet')
    // Де буде низ абетки, коли вона прикріплена під шапкою
    const navBottom = nav ? parseFloat(getComputedStyle(nav).top) + nav.offsetHeight : 0
    // Відстань від верху сторінки — через offsetTop: картки ще «випливають» (анімація зсуває getBoundingClientRect)
    let top = 0
    for (let node = el as HTMLElement | null; node; node = node.offsetParent as HTMLElement | null) top += node.offsetTop
    if (el) window.scrollTo({ top: top - navBottom - 8 })
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
      <div className="mb-4 flex items-center justify-between gap-2 sm:gap-3">
        <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-brand-600">{t('admin.products')}</h1>
        <Link
          to="/admin/import"
          className="ml-auto hidden min-h-11 items-center gap-2 rounded-xl bg-sand-200 px-4 font-bold text-ink md:inline-flex transition-transform hover:bg-sand-300 active:scale-[0.97]"
        >
          <FileSpreadsheet {...ICON} />
          {/* На телефоні імпорт — у нижньому меню «Ще» */}
          {t('admin.importFromSheet')}
        </Link>
        <Link
          to={category ? `/admin/products/new?category=${category}` : '/admin/products/new'}
          className="ml-auto inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-brand-600 px-3 font-bold text-sand-50 md:ml-0 sm:gap-2 sm:px-4 transition-transform hover:bg-brand-700 active:scale-[0.97]"
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
              className="min-h-12 w-full rounded-xl border-2 border-sand-200 bg-sand-50 px-3 text-base font-bold outline-none focus:border-brand-500 md:text-sm"
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

      {/* Абетка (коли список за назвою): прикріплена під шапкою, лише літери, на які є товари; натиснули — список прокрутився.
          Після вибору літери з'являється другий ряд: рід (якщо на літеру їх кілька) і літери сорту всередині нього. */}
      {byName && (firstOfLetter.size > 1 || (subs?.size ?? 0) > 1) && (
        <nav
          aria-label={t('admin.alphabet')}
          id="alphabet"
          className="sticky top-[var(--header-h,0px)] z-20 -mx-4 mb-3 border-b border-sand-200 bg-sand-100/95 px-4 py-2 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border sm:px-2"
        >
          <div className="flex gap-1 overflow-x-auto sm:flex-wrap">
            {[...firstOfLetter.keys()].map((letter) => (
              <button
                key={letter}
                type="button"
                aria-pressed={letter === pickedLetter}
                onClick={() => {
                  setPicked({ letter })
                  jumpTo(firstOfLetter.get(letter))
                }}
                className={`${LETTER} h-10 min-w-10 text-lg ${letter === pickedLetter ? 'bg-brand-600 text-sand-50' : 'bg-sand-50 text-brand-600'}`}
              >
                {letter}
              </button>
            ))}
          </div>
          {pickedGenus && (genera.length > 1 || (subs?.size ?? 0) > 1) && (
            <div className="mt-2 flex items-center gap-1 overflow-x-auto border-t border-sand-200 pt-2 sm:flex-wrap">
              {genera.length > 1 ? (
                genera.map((g) => (
                  <button
                    key={g}
                    type="button"
                    aria-pressed={g === pickedGenus}
                    onClick={() => {
                      setPicked({ letter: pickedLetter!, genus: g })
                      jumpTo(firstOfSub.get(g)?.values().next().value)
                    }}
                    className={`${LETTER} h-9 px-3 text-sm italic ${g === pickedGenus ? 'bg-sunset-600 text-sand-50' : 'bg-sand-50 text-ink'}`}
                  >
                    {g}
                  </button>
                ))
              ) : (
                <span className="mr-1 shrink-0 pl-1 text-sm font-bold text-sand-700 italic">{pickedGenus}</span>
              )}
              {genera.length > 1 && <span aria-hidden className="mx-1 h-6 w-px shrink-0 bg-sand-300" />}
              {[...(subs?.entries() ?? [])].sort(([a], [b]) => a.localeCompare(b, 'uk')).map(([sub, anchor]) => (
                <button
                  key={sub}
                  type="button"
                  aria-label={`${pickedGenus} ${sub}`}
                  onClick={() => jumpTo(anchor)}
                  className={`${LETTER} h-9 min-w-9 bg-sand-50 text-base text-sunset-600`}
                >
                  {sub}
                </button>
              ))}
            </div>
          )}
        </nav>
      )}

      {/* Ті самі картки, що й у магазині (з кнопками продавця й плашками «Приховано» / залишок), по кілька в ряд */}
      {shown && shown.length > 0 && (
        <div className="grid grid-cols-1 gap-5 min-[480px]:grid-cols-2 lg:grid-cols-3">
          {list.visible.map((p, i) => (
            // id — якір для абетки: до першого товару літери прокручує кнопка
            <div key={p.id} id={anchors.has(p.id) ? `p-${p.id}` : undefined} className="flex flex-col [&>article]:flex-1">
              <ProductCard product={p} index={i} />
            </div>
          ))}
        </div>
      )}
      {list.sentinel}
    </div>
  )
}
