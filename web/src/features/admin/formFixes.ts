import { nameKey, parseForms, withoutStates } from '../../lib/plantName'
import { PLANT_CATEGORY, STATE_TAGS, type PlantTag } from '../../lib/plants'
import { cultivarOf, splitCultivar, withoutSelection } from './productSchema'
import type { PlantOrigin, Product } from '../../lib/types'

/**
 * «Виправити форми»: варієгата, кристата чи монстроза — це мутація конкретної рослини, а не нове схрещування.
 * Тож «Graptoveria Debbie variegata» має бути «Відбір або мутація» від «Graptoveria Debbie»,
 * а не мати ті самі батьки, що й Debbie. Батьків-гібрида видно на сторінці самої Debbie.
 * Так само культивар (слово в лапках після назви): «Echeveria agavoides 'Maria'» — відбір від «Echeveria agavoides».
 */

export interface FormFix {
  id: string
  /** Мале фото рослини в списку правок */
  image?: string
  /** Адреса сторінки рослини — назва в списку веде туди */
  slug: string
  name: string
  /** Від якої рослини мутація — повна назва, як у товарі (або назва без форм, якщо звичайної версії в магазині немає). */
  source: string
  /** Чи є звичайна версія в магазині. Немає — все одно записуємо «мутація від …», на сайті назва буде без посилання. */
  sourceInShop: boolean
  /** form — форма (variegata…) від звичайної версії; selection — культивар від рослини без культивару */
  kind: 'form' | 'selection'
  before: { origin?: PlantOrigin; parents: string[] }
}

export interface FormFixPlan {
  fixes: FormFix[]
  /** Уже правильно: мутація саме від цієї рослини. */
  ok: number
}

type Plant = Pick<Product, 'id' | 'slug' | 'name' | 'category' | 'tags' | 'origin' | 'parents' | 'isActive' | 'genus'> & { images?: string[] }

// Назва без форм, лапок і різниці в регістрі/пробілах: «Graptoveria 'Debbie' variegata» → «graptoveriadebbie»
// («hybrid» лишається: «Orion hybrid variegata» — від «Orion hybrid», а «Orion variegata» — від «Orion»)
const keyOf = (p: Plant) => withoutStates(p.name.uk).toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
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

  const plan: FormFixPlan = { fixes: [], ok: 0 }
  const shopByKey = new Map(plants.map((p) => [nameKey(p.name.uk), p.name.uk.trim()]))

  // Культивар без форм: «Echeveria agavoides 'Maria'» — відбір від «Echeveria agavoides» (рослина без культивару).
  // Лише коли перед лапками є вид чи назва; «Echeveria 'Lola'» — сама назва гібрида, її не чіпаємо.
  function checkSelection(p: Plant) {
    if (p.tags?.includes('hybridName') || !splitCultivar(cultivarOf(p.name.uk, p.genus)).selection) return
    const plain = withoutSelection(p.name.uk)
    const inShop = shopByKey.get(nameKey(plain))
    const source = inShop ?? plain
    if (source.split(/\s+/).length < 2) return
    const parents = (p.parents ?? []).filter(Boolean)
    if (p.origin === 'cultivar' && parents.length === 1 && nameKey(parents[0]) === nameKey(source)) {
      plan.ok++
      return
    }
    plan.fixes.push({ id: p.id, slug: p.slug, name: p.name.uk, image: p.images?.[0], source, sourceInShop: !!inShop, kind: 'selection', before: { origin: p.origin, parents } })
  }
  for (const p of plants) {
    const forms = formsOf(p)
    if (forms.length === 0) {
      checkSelection(p)
      continue
    }
    // Джерело — завжди звичайна версія, без жодної форми: «Cubic Frost variegata cristata» — від «Cubic Frost»,
    // а не від «Cubic Frost variegata». Серед однакових — та, що показана на сайті.
    const candidates = (byKey.get(keyOf(p)) ?? [])
      .filter((q) => q.id !== p.id && formsOf(q).length === 0)
      .sort((a, b) => Number(b.isActive) - Number(a.isActive))
    // Звичайної версії в магазині немає («Lola variegata», а просто «Lola» немає) — джерело все одно «Lola»:
    // так у походженні видно, від чого мутація, хоч посилання на сайті й не буде
    const inShop = candidates[0]?.name.uk.trim()
    const source = inShop ?? withoutStates(p.name.uk)
    // Без форм лишився сам рід («Greenovia variegata» → «Greenovia») — від чого мутація, невідомо
    if (!source || source.split(/\s+/).length < 2) continue
    const parents = (p.parents ?? []).filter(Boolean)
    // Уже правильно, навіть якщо джерело записане трохи інакше (без лапок, іншими літерами регістру)
    if (p.origin === 'cultivar' && parents.length === 1 && nameKey(parents[0]) === nameKey(source)) {
      plan.ok++
      continue
    }
    plan.fixes.push({ id: p.id, slug: p.slug, name: p.name.uk, image: p.images?.[0], source, sourceInShop: !!inShop, kind: 'form', before: { origin: p.origin, parents } })
  }
  plan.fixes.sort((a, b) => a.name.localeCompare(b.name))
  return plan
}
