import { Search, X } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { GENERA } from '../../lib/plants'
import { searchProducts } from '../../lib/search'
import { rememberSearch } from '../../shared/navigation'
import { PageTitle } from '../../shared/ui'
import { useAuth } from '../auth/authStore'
import { useAllProducts } from './api'
import { useCategories } from './categories'
import { ProductGrid } from './ProductCard'

/** /search?q=… — пошук по всьому каталогу; запит зберігається в адресі, тож результатом можна поділитися. */
export function SearchPage() {
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()
  const query = params.get('q') ?? ''
  // Продавець шукає по всьому каталогу — разом із прихованими товарами й категоріями.
  const isSeller = useAuth((s) => s.role === 'seller')
  const { data: products, isLoading, isError } = useAllProducts(isSeller)
  const { isVisible, nameOf } = useCategories()

  const visible = useMemo(() => (products ?? []).filter((p) => isSeller || isVisible(p.category)), [products, isVisible, isSeller])
  const results = useMemo(
    () => searchProducts(visible, query, { categoryName: nameOf, tagLabel: (tag) => t(`tags.${tag}`) }),
    [visible, query, nameOf, t],
  )
  // Підказки, коли запит порожній: роди, які зараз є в магазині.
  const genera = useMemo(() => GENERA.filter((g) => visible.some((p) => p.genus === g)), [visible])

  const setQuery = (q: string) => setParams(q ? { q } : {}, { replace: true })
  // Запам’ятовуємо запит (і набраний, і з посилання на кшталт «батько» на картці) — для «Пошуку» в меню
  useEffect(() => rememberSearch(query), [query])

  return (
    <div className="space-y-6">
      <PageTitle>{t('search.title')}</PageTitle>

      <form role="search" onSubmit={(e) => e.preventDefault()} className="relative">
        <Search size={22} strokeWidth={2.25} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-sand-700" aria-hidden />
        <input
          type="search"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('search.placeholder')}
          aria-label={t('search.title')}
          enterKeyHint="search"
          className="h-14 w-full rounded-2xl border-2 border-sand-200 bg-sand-50 pr-12 pl-12 text-lg outline-none transition-colors focus:border-brand-500 [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label={t('search.clear')}
            className="absolute top-1/2 right-2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl text-sand-700 hover:bg-sand-200"
          >
            <X size={20} strokeWidth={2.25} aria-hidden />
          </button>
        )}
      </form>

      {isLoading && <p className="text-sand-700">{t('loading')}</p>}
      {isError && <p className="text-red-700">{t('errors.loading')}</p>}

      {!query && genera.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-bold text-sand-700">{t('search.tryGenus')}</p>
          <div className="flex flex-wrap gap-2">
            {genera.map((g) => (
              <button
                key={g}
                onClick={() => setQuery(g)}
                className="min-h-10 rounded-full border-2 border-sand-200 bg-sand-50 px-4 text-sm font-bold italic hover:border-brand-500"
              >
                {g}
              </button>
            ))}
          </div>
        </div>
      )}

      {query && products && (
        <>
          <p className="font-bold" aria-live="polite">
            {results.length ? t('search.found', { count: results.length }) : t('search.nothing', { query })}
          </p>
          {results.length === 0 && <p className="text-sand-700">{t('search.nothingHint')}</p>}
          <ProductGrid products={results} sellerTools={{}} />
        </>
      )}
    </div>
  )
}
