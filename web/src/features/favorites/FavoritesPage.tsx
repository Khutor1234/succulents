import { useQuery } from '@tanstack/react-query'
import { doc, getDoc } from 'firebase/firestore'
import { Heart } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { db } from '../../firebase/config'
import { withKnownTags } from '../catalog/api'
import type { Product } from '../../lib/types'
import { useCategories } from '../catalog/categories'
import { ProductGrid } from '../catalog/ProductCard'
import { BackToAccount } from '../account/AccountPage'
import { PageTitle } from '../../shared/ui'
import { useFavorites } from './favoritesStore'

/** Свіжі дані улюблених товарів (наявність і ціна змінюються) — кожен окремо, за id. */
function useFavoriteProducts(ids: string[]) {
  return useQuery({
    queryKey: ['favorites', ids],
    queryFn: async () => {
      const products = await Promise.all(
        ids.map(async (id) => {
          try {
            const snap = await getDoc(doc(db, 'products', id))
            return snap.exists() ? withKnownTags({ id: snap.id, ...snap.data() } as Product) : null
          } catch {
            return null // прихований товар покупцю не видно
          }
        }),
      )
      return products.filter((p): p is Product => !!p && p.isActive)
    },
    staleTime: 0,
  })
}

/** Улюблені рослини (окремий екран кабінету): зручно стежити, коли та, якої зараз немає, знову з'явиться в наявності. */
export function FavoritesPage() {
  const { t } = useTranslation()
  const ids = useFavorites((s) => s.ids)
  const { isVisible } = useCategories()
  const { data, isLoading, isError } = useFavoriteProducts(ids)
  const products = (data ?? []).filter((p) => isVisible(p.category))
  const inStock = products.filter((p) => p.stock > 0).length

  return (
    <div>
      <BackToAccount />
      <PageTitle>{t('favorites.title')}</PageTitle>
      {ids.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-sand-300 px-6 py-10 text-center">
          <Heart size={40} strokeWidth={1.75} className="mx-auto text-sunset-500" aria-hidden />
          <p className="mt-4 font-bold">{t('favorites.empty')}</p>
          <p className="mx-auto mt-1 max-w-md text-sand-700">{t('favorites.emptyHint')}</p>
          <Link to="/c/plants" className="mt-6 inline-block rounded-xl bg-brand-600 px-6 py-3.5 font-bold text-sand-50 hover:bg-brand-700">
            {t('home.toCatalog')}
          </Link>
        </div>
      ) : (
        <>
          {isLoading && <p className="text-sand-700">{t('loading')}</p>}
          {isError && <p className="text-red-700">{t('errors.loading')}</p>}
          {data && (
            <p className="-mt-2 mb-4 text-sand-700">
              {t('favorites.summary', { count: products.length })} · {t('favorites.inStock', { count: inStock })}
              {products.length > inStock && <> · {t('favorites.watchHint')}</>}
            </p>
          )}
          {products.length > 0 && <ProductGrid products={products} />}
        </>
      )}
    </div>
  )
}
