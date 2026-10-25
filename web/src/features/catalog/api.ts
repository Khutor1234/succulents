import { useQuery } from '@tanstack/react-query'
import { collection, getDocs, limit, orderBy, query, where, type QueryConstraint } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { knownTags, PLANT_CATEGORY } from '../../lib/plants'
import { KEEP_LAST } from '../../lib/shop'
import type { Category, Product } from '../../lib/types'

/** Прибирає з товару застарілі теги (напр. колишній 'hybrid'). */
export const withKnownTags = (p: Product): Product => (p.tags ? { ...p, tags: knownTags(p.tags) } : p)

/**
 * Скільки може купити покупець: не на продаж — 0 («немає в наявності»); у рослин — без останньої (KEEP_LAST),
 * її лишаємо собі. Продавець бачить справжній залишок.
 */
export const buyerStock = (p: Pick<Product, 'stock' | 'forSale' | 'category'>) =>
  p.forSale === false ? 0 : p.category === PLANT_CATEGORY ? Math.max(0, p.stock - KEEP_LAST) : p.stock

export const forBuyer = (p: Product): Product => ({ ...p, stock: buyerStock(p) })

/** Для покупця: лише видимі товари, і ті, що не на продаж, — з нульовим залишком. */
async function fetchProducts(...constraints: QueryConstraint[]): Promise<Product[]> {
  return (await fetchAny(where('isActive', '==', true), ...constraints)).map(forBuyer)
}

/** Без фільтра видимості — приховані товари бачить лише продавець (так дозволяють Rules). */
async function fetchAny(...constraints: QueryConstraint[]): Promise<Product[]> {
  const snap = await getDocs(query(collection(db, 'products'), ...constraints))
  return snap.docs.map((d) => withKnownTags({ id: d.id, ...d.data() } as Product))
}

const newestFirst = (a: Product, b: Product) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0)

/** `withHidden` — для продавця: разом із прихованими товарами. */
export function useProducts(category: Category, withHidden = false) {
  return useQuery({
    queryKey: ['products', category, withHidden],
    queryFn: () =>
      withHidden
        ? // Сортуємо в браузері — так не потрібен окремий індекс Firestore для «категорія + дата» без isActive
          fetchAny(where('category', '==', category)).then((list) => list.sort(newestFirst))
        : fetchProducts(where('category', '==', category), orderBy('createdAt', 'desc')),
  })
}

export function useLatestProducts(count = 8, withHidden = false) {
  return useQuery({
    queryKey: ['products', 'latest', count, withHidden],
    queryFn: () => (withHidden ? fetchAny : fetchProducts)(orderBy('createdAt', 'desc'), limit(count)),
  })
}

/** `withHidden` — для продавця: відкривається й прихований товар. */
export function useProduct(slug: string, withHidden = false) {
  return useQuery({
    queryKey: ['product', slug, withHidden],
    queryFn: async () => (await (withHidden ? fetchAny : fetchProducts)(where('slug', '==', slug), limit(1)))[0] ?? null,
  })
}

/**
 * Чи є в магазині товар саме з такою назвою — напр., звичайна версія, від якої варієгата «мутація від …».
 * Немає — назву показуємо без посилання. Один дешевий запит за точною назвою (а не весь каталог).
 */
export function useNameInShop(name: string | undefined, withHidden = false) {
  return useQuery({
    queryKey: ['product-name', name, withHidden],
    enabled: !!name,
    queryFn: async () => {
      const constraints = [where('name.uk', '==', name!), ...(withHidden ? [] : [where('isActive', '==', true)]), limit(1)]
      return !(await getDocs(query(collection(db, 'products'), ...constraints))).empty
    },
  })
}

/**
 * Увесь видимий каталог — для пошуку (товарів сотні, тож простіше шукати прямо в браузері).
 * `withHidden` — для продавця: разом із прихованими товарами.
 */
export function useAllProducts(withHidden = false) {
  return useQuery({
    queryKey: ['products', 'all', withHidden],
    queryFn: () => (withHidden ? fetchAny() : fetchProducts()),
    staleTime: 5 * 60 * 1000,
  })
}
