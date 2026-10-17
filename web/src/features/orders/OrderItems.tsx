import { useQuery } from '@tanstack/react-query'
import { doc, getDoc } from 'firebase/firestore'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { db } from '../../firebase/config'
import { useLang } from '../../i18n'
import { formatPrice, pick } from '../../lib/format'
import type { OrderItem } from '../../lib/types'
import { ProductImage } from '../../shared/ui'

interface ProductRef {
  slug?: string
  image?: string
}

/**
 * Актуальні фото й адреси товарів замовлення. Потрібно для старих замовлень (без фото в знімку)
 * і для посилань на сторінку товару. Прихований чи видалений товар просто лишається без посилання.
 */
function useProductRefs(ids: string[]) {
  return useQuery({
    queryKey: ['productRefs', [...ids].sort()],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const entries = await Promise.all(
        ids.map(async (id): Promise<[string, ProductRef]> => {
          try {
            const snap = await getDoc(doc(db, 'products', id))
            const data = snap.data()
            return [id, { slug: data?.isActive ? data.slug : undefined, image: data?.images?.[0] }]
          } catch {
            return [id, {}] // Rules не дають читати прихований товар покупцю — це нормально.
          }
        }),
      )
      return Object.fromEntries(entries)
    },
  })
}

export function OrderItems({ items }: { items: OrderItem[] }) {
  const { t } = useTranslation()
  const lang = useLang()
  const { data: refs } = useProductRefs(items.map((i) => i.productId))

  return (
    <ul className="divide-y-2 divide-sand-200">
      {items.map((item) => {
        const ref = refs?.[item.productId]
        const name = pick(item.name, lang)
        const cancelledQty = item.added ? 0 : (item.originalQty ?? item.qty) - item.qty
        const fullyCancelled = item.qty === 0
        return (
          <li key={item.productId} className={`flex items-center gap-3 py-3 ${fullyCancelled ? 'opacity-60' : ''}`}>
            <div className="w-16 shrink-0">
              <ProductImage src={item.image ?? ref?.image} alt={name} />
            </div>
            <div className="min-w-0 flex-1">
              {ref?.slug ? (
                <Link to={`/product/${ref.slug}`} className={`font-bold hover:text-brand-600 ${fullyCancelled ? 'line-through' : ''}`}>
                  {name}
                </Link>
              ) : (
                <span className={`font-bold ${fullyCancelled ? 'line-through' : ''}`}>{name}</span>
              )}
              <p className="text-sm text-sand-700">
                {item.qty} × {formatPrice(item.price, lang)}
                {item.originalPrice !== undefined && item.originalPrice !== item.price && (
                  <span className="ml-1.5 line-through">{t('orders.priceChanged', { price: formatPrice(item.originalPrice, lang) })}</span>
                )}
              </p>
              {item.added && <p className="text-sm font-medium text-brand-600">{t('orders.addedBySeller')}</p>}
              {cancelledQty > 0 && (
                <p className="text-sm font-medium text-red-700">
                  {fullyCancelled ? t('orders.itemCancelled') : t('orders.itemPartlyCancelled', { count: cancelledQty, total: item.originalQty })}
                </p>
              )}
            </div>
            <span className="font-display font-extrabold whitespace-nowrap">{formatPrice(item.price * item.qty, lang)}</span>
          </li>
        )
      })}
    </ul>
  )
}
