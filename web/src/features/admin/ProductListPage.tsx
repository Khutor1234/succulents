import { Check, ChevronDown, EyeOff, List, ListChecks, Pencil, Plus, PowerOff, Tags } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
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
import { CopyName, CuttingToggle, DeleteButton, DisableButton, ForSaleButton, HomePin, SellerStock, VisibilityButton } from '../catalog/ProductCard'
import { ORIGINS, originOf } from '../catalog/usePlantFilters'
import { useAllProducts, useSetPrice } from './api'
import { CategoriesPage } from './CategoriesPage'
import { ListsPage } from './ListsPage'
import { ListButton } from '../catalog/ListButton'
import { TabBar, useTab } from './TabBar'

const TABS = ['list', 'lists', 'disabled', 'categories'] as const
const TAB_ICONS = { list: List, lists: ListChecks, disabled: PowerOff, categories: Tags }

/** Фільтр «Показати»: усі, лише в наявності, у продажу, не продаються, видимі покупцям, приховані. */
const SHOWS = ['all', 'inStock', 'outOfStock', 'withPhoto', 'noPhoto', 'forSale', 'notForSale', 'visible', 'hidden', 'onHome', 'cutting'] as const
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
}

type Sort = 'name' | 'new' | 'old' | 'priceDesc' | 'priceAsc' | 'stock' | 'stockAsc'
const SORTS: Sort[] = ['name', 'new', 'old', 'priceDesc', 'priceAsc', 'stock', 'stockAsc']
const byName = (a: Product, b: Product) => a.name.uk.replace(/['‘’"«»]/g, '').localeCompare(b.name.uk.replace(/['‘’"«»]/g, ''), 'uk')
const COMPARE: Record<Sort, (a: Product, b: Product) => number> = {
  name: byName,
  new: (a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0) || byName(a, b),
  old: (a, b) => (a.createdAt?.toMillis() ?? 0) - (b.createdAt?.toMillis() ?? 0) || byName(a, b),
  priceDesc: (a, b) => b.price - a.price || byName(a, b),
  priceAsc: (a, b) => a.price - b.price || byName(a, b),
  stock: (a, b) => b.stock - a.stock || byName(a, b),
  stockAsc: (a, b) => a.stock - b.stock || byName(a, b),
}

/**
 * Товари списком (лише продавець, плитка «Каталог» в адмінці): вузькі рядки — мала фотка, назва, ціна, кількість «− N +»
 * і ті самі швидкі кнопки, що й на картках у магазині. Щоб на екран влазило багато товарів одразу.
 * Друга вкладка — «Категорії» (?tab=categories, CategoriesPage.tsx): які категорії видно в меню магазину.
 */
export function ProductListPage() {
  const { t } = useTranslation()
  const [tab, setTab] = useTab(TABS)
  const { data: all, isLoading, isError } = useAllProducts(true)
  // «Список» — без вимкнених; «Вимкнені» (?tab=disabled) — лише вони
  const data = useMemo(() => all?.filter((p) => !!p.disabled === (tab === 'disabled')), [all, tab])
  const { all: categories, nameOf } = useCategories()
  const [query, setQuery] = useState('')
  // Три окремі фільтри (можна поєднувати): «Показати», «Походження» і в самому кінці «Категорія»
  const [show, setShow] = useState<Show>('all')
  const [origin, setOrigin] = useState('')
  const [category, setCategory] = useState('')
  const [sort, setSort] = useState<Sort>('name')

  const shown = useMemo(() => {
    const list = (data ?? []).filter((p) => (!category || p.category === category) && (!origin || originOf(p) === origin) && SHOW_TEST[show](p))
    if (query.trim()) return searchProducts(list, query, { categoryName: nameOf, tagLabel: (tag) => t(`tags.${tag}`) })
    return list.sort(COMPARE[sort])
  }, [data, category, origin, show, query, sort, nameOf, t])
  const { visible, sentinel } = useProgressive(shown, 60, `${tab}|${show}|${origin}|${category}|${query}|${sort}`)

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
      ) : tab === 'lists' ? (
        <ListsPage />
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
        {/* Один список «Фільтр» з трьома частинами: стан товару, походження, у кінці категорія. У кожній частині — свій вибір, вони поєднуються */}
        <FilterMenu
          label={t('admin.list.show')}
          groups={[
            { value: show, onChange: (v) => setShow(v as Show), options: SHOWS.map((x) => ({ value: x, label: t(`admin.list.shows.${x}`) })) },
            {
              title: t('catalog.origin'),
              value: origin,
              onChange: setOrigin,
              options: [{ value: '', label: t('admin.list.allOrigins') }, ...ORIGINS.map((o) => ({ value: o, label: t(`admin.fields.origins.${o}`) }))],
            },
            {
              title: t('admin.list.category'),
              value: category,
              onChange: setCategory,
              options: [{ value: '', label: t('admin.list.allCategories') }, ...categories.map((c) => ({ value: c.id, label: c.name }))],
            },
          ]}
        />
      </div>

      {isLoading && <p className="text-sand-700">{t('loading')}</p>}
      {isError && <p className="text-red-700">{t('errors.loading')}</p>}
      {tab === 'disabled' && <p className="text-sm text-sand-700">{t('admin.list.disabledHint')}</p>}
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
        <ListButton product={product} name={name} />
        {product.category === PLANT_CATEGORY && <CuttingToggle product={product} name={name} compact />}
        <DisableButton product={product} name={name} />
        <DeleteButton product={product} name={name} compact />
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

type FilterGroup = { title?: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }

/**
 * Один випадний список фільтрів, поділений на частини (заголовок над кожною, крім першої). У кожній частині вибирається
 * одне значення, частини поєднуються; меню не закривається після вибору — можна одразу вибрати й у наступній частині.
 * На кнопці — усе вибране через «·» (нічого не вибрано — перший пункт першої частини, «Усі товари»).
 */
function FilterMenu({ label, groups }: { label: string; groups: FilterGroup[] }) {
  const [open, setOpen] = useState(false)
  // Кнопка близько до правого краю екрана — меню відкривається вліво від неї, щоб не вилізти за край
  const [alignRight, setAlignRight] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  const chosen = groups.flatMap((g) => (g.value !== g.options[0]?.value ? [g.options.find((o) => o.value === g.value)?.label ?? ''] : []))
  const summary = chosen.length ? chosen.join(' · ') : groups[0]?.options[0]?.label
  return (
    <div ref={root} className="relative min-w-0">
      <button
        type="button"
        onClick={() => {
          const r = root.current?.getBoundingClientRect()
          setAlignRight(!!r && r.left + 272 > window.innerWidth)
          setOpen(!open)
        }}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={label}
        className={`flex min-h-10 max-w-full items-center gap-2 rounded-xl border-2 bg-sand-50 py-1.5 pr-3 pl-3 text-left text-sm font-bold text-ink transition-[border-color,box-shadow] hover:border-sand-400 ${
          open ? 'border-brand-500 ring-4 ring-brand-500/15' : chosen.length ? 'border-brand-500' : 'border-sand-200'
        }`}
      >
        <span className="truncate">{summary}</span>
        <ChevronDown size={16} strokeWidth={2.5} className={`shrink-0 text-brand-600 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {open && (
        <div className={`absolute top-[calc(100%+6px)] ${alignRight ? 'right-0' : 'left-0'} z-50 max-h-[70vh] w-64 max-w-[calc(100vw-2rem)] origin-top animate-menu-in overflow-auto rounded-2xl border-2 border-sand-200 bg-sand-50 p-1.5 shadow-[0_18px_40px_-12px_rgba(43,33,24,0.35)]`}>
          {groups.map((g, gi) => (
            <div key={gi} role="radiogroup" aria-label={g.title ?? label} className={gi ? 'mt-1.5 border-t-2 border-sand-200 pt-1.5' : ''}>
              {g.title && <p className="px-3 pt-1 pb-1 text-xs font-bold tracking-wide text-sand-700 uppercase">{g.title}</p>}
              {g.options.map((o) => {
                const on = o.value === g.value
                return (
                  <button
                    key={o.value}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => g.onChange(o.value)}
                    className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-sand-200 ${on ? 'font-bold text-brand-700' : 'font-medium text-ink'}`}
                  >
                    <Check size={16} strokeWidth={3} className={`shrink-0 ${on ? '' : 'invisible'}`} aria-hidden />
                    {o.label}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
