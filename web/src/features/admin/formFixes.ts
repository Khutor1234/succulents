import { parseForms } from '../../lib/plantName'
import { PLANT_CATEGORY, STATE_TAGS, type PlantTag } from '../../lib/plants'
import type { PlantOrigin, Product } from '../../lib/types'

/**
 * «Виправити форми»: варієгата, кристата чи монстроза — це мутація конкретної рослини, а не нове схрещування.
 * Тож «Graptoveria Debbie variegata» має бути «Відбір або мутація» від «Graptoveria Debbie»,
 * а не мати ті самі батьки, що й Debbie. Батьків-гібрида видно на сторінці самої Debbie.
 */

export interface FormFix {
  id: string
  name: string
  /** Від якої рослини мутація — повна назва, як у товарі. */
  source: string
  before: { origin?: PlantOrigin; parents: string[] }
}

export interface FormFixPlan {
  fixes: FormFix[]
  /** Уже правильно: мутація саме від цієї рослини. */
  ok: number
  /** Рослини з формою, для яких у магазині немає звичайної версії (без форм). */
  noSource: string[]
}

type Plant = Pick<Product, 'id' | 'name' | 'category' | 'tags' | 'origin' | 'parents' | 'isActive'>

// Назва без форм, лапок і різниці в регістрі/пробілах: «Graptoveria 'Debbie' variegata» → «graptoveriadebbie»
const keyOf = (p: Plant) => parseForms(p.name.uk).base.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
// Форми з галочок і з назви разом
const formsOf = (p: Plant): PlantTag[] => {
  const fromName = parseForms(p.name.uk).states
  return STATE_TAGS.filter((s) => p.tags?.includes(s) || fromName.includes(s))
}

export function planFormFixes(products: Plant[]): FormFixPlan {
  const plants = products.filter((p) => p.category === PLANT_CATEGORY)
  const byKey = new Map<string, Plant[]>()
  for (const p of plants) {
    const key = keyOf(p)
    byKey.set(key, [...(byKey.get(key) ?? []), p])
  }

  const plan: FormFixPlan = { fixes: [], ok: 0, noSource: [] }
  for (const p of plants) {
    const forms = formsOf(p)
    if (forms.length === 0) continue
    // Джерело — завжди звичайна версія, без жодної форми: «Cubic Frost variegata cristata» — від «Cubic Frost»,
    // а не від «Cubic Frost variegata». Серед однакових — та, що показана на сайті.
    const candidates = (byKey.get(keyOf(p)) ?? [])
      .filter((q) => q.id !== p.id && formsOf(q).length === 0)
      .sort((a, b) => Number(b.isActive) - Number(a.isActive))
    const source = candidates[0]?.name.uk.trim()
    if (!source) {
      plan.noSource.push(p.name.uk)
      continue
    }
    const parents = (p.parents ?? []).filter(Boolean)
    if (p.origin === 'cultivar' && parents.length === 1 && parents[0].trim() === source) {
      plan.ok++
      continue
    }
    plan.fixes.push({ id: p.id, name: p.name.uk, source, before: { origin: p.origin, parents } })
  }
  plan.fixes.sort((a, b) => a.name.localeCompare(b.name))
  plan.noSource.sort((a, b) => a.localeCompare(b))
  return plan
}
