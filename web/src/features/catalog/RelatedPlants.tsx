import { useTranslation } from 'react-i18next'
import type { Product } from '../../lib/types'
import { useAllProducts } from './api'
import { useCategories } from './categories'
import { ProductCard } from './ProductCard'

type Relation = 'form' | 'parent' | 'child' | 'sibling'

// Слова, що позначають особливу форму, — без них «Echeveria 'Lola' variegata» і «Echeveria 'Lola'» — та сама рослина
const FORM_WORDS = /\b(variegat[a-z]*|cristat[a-z]*|monstros[a-z]*|forma|f\.|var\.)(?=\s|$)/g

/** Назва без лапок, регістру й позначок форми — щоб порівнювати рослини між собою. */
export function plantKey(name: string) {
  return name
    .toLowerCase()
    .replace(/['‘’"«»`]/g, ' ')
    .replace(FORM_WORDS, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const ORDER: Relation[] = ['form', 'parent', 'child', 'sibling']
const MAX = 8

/**
 * Як інші рослини пов’язані з цією:
 * - інша форма тієї ж рослини (звичайна ↔ variegata/cristata);
 * - один із її батьків;
 * - гібрид, у якого вона — один із батьків;
 * - рослина зі спільним батьком.
 */
function relationOf(product: Product, other: Product): Relation | null {
  const self = plantKey(product.name.uk)
  const otherKey = plantKey(other.name.uk)
  const parents = (product.parents ?? []).filter(Boolean).map(plantKey)
  const otherParents = (other.parents ?? []).filter(Boolean).map(plantKey)
  if (otherKey === self) return 'form'
  if (parents.includes(otherKey)) return 'parent'
  if (otherParents.includes(self)) return 'child'
  if (parents.some((p) => otherParents.includes(p))) return 'sibling'
  return null
}

const BADGE: Record<Relation, string> = {
  form: 'bg-sunset-100 text-sunset-700',
  parent: 'bg-brand-600 text-sand-50',
  child: 'bg-brand-100 text-brand-700',
  sibling: 'bg-sand-200 text-sand-700',
}

/** Пов’язані рослини, що є в наявності, — під карткою товару. */
export function RelatedPlants({ product }: { product: Product }) {
  const { t } = useTranslation()
  const { data } = useAllProducts()
  const { isVisible } = useCategories()
  if (!data) return null

  const related = data
    .filter((p) => p.id !== product.id && p.isActive && p.stock > 0 && isVisible(p.category))
    .map((p) => ({ p, rel: relationOf(product, p) }))
    .filter((x): x is { p: Product; rel: Relation } => !!x.rel)
    .sort((a, b) => ORDER.indexOf(a.rel) - ORDER.indexOf(b.rel))
    .slice(0, MAX)
  if (related.length === 0) return null

  return (
    <section className="mt-14" aria-labelledby="related-title">
      <h2 id="related-title" className="font-display text-3xl font-extrabold text-brand-600">
        {t('related.title')}
      </h2>
      <p className="mt-1 mb-5 text-sand-700">{t('related.hint')}</p>
      <div className="grid grid-cols-1 gap-5 min-[480px]:grid-cols-2 lg:grid-cols-3">
        {related.map(({ p, rel }, i) => (
          <div key={p.id} className="flex flex-col">
            {/* Підпис над карткою: як саме ця рослина пов’язана з поточною */}
            <span className={`mb-2 self-start rounded-full px-3 py-1 text-xs font-bold ${BADGE[rel]}`}>{t(`related.${rel}`)}</span>
            <div className="flex flex-1 flex-col [&>article]:flex-1">
              <ProductCard product={p} index={i} />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
