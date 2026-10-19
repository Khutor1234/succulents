import { useTranslation } from 'react-i18next'
import { baseKey, editDistance, nameKey } from '../../lib/plantName'
import type { Product } from '../../lib/types'
import { useAuth } from '../auth/authStore'
import { useAllProducts } from './api'
import { useCategories } from './categories'
import { ProductCard } from './ProductCard'

type Relation = 'form' | 'parent' | 'child' | 'sibling'

const ORDER: Relation[] = ['form', 'parent', 'child', 'sibling']
const MAX = 8

/**
 * Як інші рослини пов’язані з цією:
 * - інша форма тієї ж рослини (звичайна ↔ variegata/cristata);
 * - один із її батьків;
 * - гібрид, у якого вона — один із батьків;
 * - рослина зі спільним батьком.
 */
/**
 * Батька записали з опискою («Graptoveria 'Debbi'», а рослина — «Graptoveria 'Debbie'»)? Якщо точної назви серед товарів
 * немає, беремо товар того самого роду, що відрізняється щонайбільше на 2 букви. Інакше лишаємо як записано.
 */
function makeResolver(keys: string[]) {
  const known = new Set(keys)
  const cache = new Map<string, string>()
  return (name: string) => {
    const key = nameKey(name)
    if (known.has(key)) return key
    const hit = cache.get(key)
    if (hit !== undefined) return hit
    const genus = key.split(' ')[0]
    let best = key
    let bestDist = 3
    for (const k of keys) {
      if (k.split(' ')[0] !== genus || k.length < 6) continue
      const dist = editDistance(key, k)
      if (dist < bestDist) {
        best = k
        bestDist = dist
      }
    }
    cache.set(key, best)
    return best
  }
}

function relationOf(product: Product, other: Product, resolve: (name: string) => string): Relation | null {
  // Назви порівнюємо без лапок, регістру й різниці в написанні форм (lib/plantName: nameKey, baseKey)
  if (baseKey(other.name.uk) === baseKey(product.name.uk)) return 'form'
  // Батьки — точна назва разом із формою: батько «Echeveria lilacina» — це саме lilacina,
  // а не «lilacina variegata» чи «lilacina monstrose» (то її форми, а не батьки)
  const self = nameKey(product.name.uk)
  const otherKey = nameKey(other.name.uk)
  const parents = (product.parents ?? []).filter(Boolean).map(resolve)
  const otherParents = (other.parents ?? []).filter(Boolean).map(resolve)
  if (parents.includes(otherKey)) return 'parent'
  if (otherParents.includes(self)) return 'child'
  // «Спільний батько» — лише між гібридами: мутація (напр. «lilacina monstrose») — це форма свого джерела,
  // а не «брат» гібридам від lilacina, і навпаки
  if (product.origin !== 'cultivar' && other.origin !== 'cultivar' && parents.some((p) => otherParents.includes(p))) return 'sibling'
  return null
}

const BADGE: Record<Relation, string> = {
  form: 'bg-sunset-100 text-sunset-700',
  parent: 'bg-brand-600 text-sand-50',
  child: 'bg-brand-100 text-brand-700',
  sibling: 'bg-sand-200 text-sand-700',
}

// Для продавця всередині кожного виду зв’язку: спершу в наявності, далі немає, у кінці приховані
const rank = (p: Product) => (!p.isActive ? 2 : p.stock === 0 ? 1 : 0)

/**
 * Пов’язані рослини під карткою товару. Покупцям — лише ті, що є в наявності;
 * продавцю — усі, разом із прихованими й закінченими (на картках є плашки «Приховано» / «Немає»).
 */
export function RelatedPlants({ product }: { product: Product }) {
  const { t } = useTranslation()
  const isSeller = useAuth((s) => s.role === 'seller')
  const { data } = useAllProducts(isSeller)
  const { isVisible } = useCategories()
  if (!data) return null
  // Описки в назвах батьків виправляємо за назвами товарів, які бачить цей відвідувач
  const resolve = makeResolver(data.map((p) => nameKey(p.name.uk)))

  const related = data
    .filter((p) => p.id !== product.id && (isSeller || (p.isActive && p.stock > 0 && isVisible(p.category))))
    .map((p) => ({ p, rel: relationOf(product, p, resolve) }))
    .filter((x): x is { p: Product; rel: Relation } => !!x.rel)
    .sort((a, b) => (isSeller ? rank(a.p) - rank(b.p) : 0))
  // Групи за видом зв’язку — у кожній не більше MAX карток
  const groups = ORDER.map((rel) => ({ rel, items: related.filter((x) => x.rel === rel).slice(0, MAX).map((x) => x.p) })).filter(
    (g) => g.items.length > 0,
  )
  if (groups.length === 0) return null

  return (
    <section className="mt-14" aria-labelledby="related-title">
      <h2 id="related-title" className="font-display text-3xl font-extrabold text-brand-600">
        {t('related.title')}
      </h2>
      <p className="mt-1 text-sand-700">{t(isSeller ? 'related.sellerHint' : 'related.hint')}</p>
      {groups.map(({ rel, items }) => (
        <div key={rel} className="mt-6">
          {/* Підпис групи: як саме ці рослини пов’язані з поточною */}
          <h3 className="mb-3 flex items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-sm font-bold ${BADGE[rel]}`}>{t(`related.groups.${rel}`)}</span>
            <span className="text-sm font-bold text-sand-700 tabular-nums">{items.length}</span>
          </h3>
          {/* Дрібніші картки: на комп’ютері по 4 в ряд */}
          <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {items.map((p, i) => (
              <ProductCard key={p.id} product={p} index={i} fullNames />
            ))}
          </div>
        </div>
      ))}
    </section>
  )
}
