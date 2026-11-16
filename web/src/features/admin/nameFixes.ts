import { editDistance, nameKey } from '../../lib/plantName'
import { PLANT_CATEGORY } from '../../lib/plants'
import type { Product } from '../../lib/types'

/**
 * «Виправити назви»: батьки, записані не так, як рослина в магазині, — інші лапки чи регістр («graptoveria Debbie»)
 * або описка в кілька букв («Debbi»). Через описку батько й нащадки не пов'язуються між собою (сторінка товару,
 * «Пов'язані рослини», аналітика). Тут такі назви стають точно такими, як у магазині.
 * Якщо самої рослини в магазині немає, а серед батьків вона записана по-різному («Echeveria moon» і «Echeveria Moon»),
 * правильне написання вибирає продавець (за замовчуванням — найчастіше).
 */

export interface NameChange {
  from: string
  to: string
  /** Описка (кілька букв різниці), а не лише інші лапки чи регістр */
  typo: boolean
  /** Рослини немає в магазині — з яких написань можна вибрати правильне (ключ групи — key) */
  choices?: string[]
  key: string
}

export interface NameFix {
  id: string
  slug: string
  name: string
  changes: NameChange[]
  /** Нові батьки рослини */
  parents: string[]
  /** Нове «Походження звичайної версії» (для форм), якщо там теж були назви до виправлення */
  base?: Product['base']
}

type Plant = Pick<Product, 'id' | 'slug' | 'name' | 'category' | 'parents' | 'base'>

/** `chosen` — вибране продавцем правильне написання для рослин, яких немає в магазині (ключ — nameKey). */
export function planNameFixes(products: Plant[], chosen: ReadonlyMap<string, string> = new Map()): NameFix[] {
  const plants = products.filter((p) => p.category === PLANT_CATEGORY)
  const shopByKey = new Map(plants.map((p) => [nameKey(p.name.uk), p.name.uk.trim()]))
  const shopKeys = [...shopByKey.keys()]

  // Як рослину записано серед батьків і скільки разів
  const spellings = new Map<string, Map<string, number>>()
  for (const p of plants)
    for (const raw of [...(p.parents ?? []), ...(p.base?.parents ?? [])]) {
      const name = raw.trim()
      if (!name) continue
      const sp = spellings.get(nameKey(name)) ?? new Map<string, number>()
      spellings.set(nameKey(name), sp.set(name, (sp.get(name) ?? 0) + 1))
    }

  // Як правильно записати батька: точно як у магазині; немає — найближча назва того самого роду (описка до 2 букв);
  // і такої немає, але написань кілька — вибране продавцем або найчастіше
  const targets = new Map<string, Omit<NameChange, 'from'> | null>()
  const targetOf = (key: string) => {
    if (targets.has(key)) return targets.get(key)!
    let found: Omit<NameChange, 'from'> | null = shopByKey.has(key) ? { key, to: shopByKey.get(key)!, typo: false } : null
    if (!found) {
      let best: { key: string; dist: number } | null = null
      for (const pk of shopKeys) {
        // Лише той самий рід і не надто короткі назви — як на сторінці товару (RelatedPlants)
        if (pk.split(' ')[0] !== key.split(' ')[0] || pk.length < 6) continue
        const dist = editDistance(key, pk)
        if (dist <= 2 && (!best || dist < best.dist)) best = { key: pk, dist }
      }
      if (best) found = { key, to: shopByKey.get(best.key)!, typo: true }
    }
    const sp = spellings.get(key)
    if (!found && sp && sp.size > 1) {
      const choices = [...sp].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([name]) => name)
      const pick = chosen.get(key)
      found = { key, to: pick && choices.includes(pick) ? pick : choices[0], typo: false, choices }
    }
    targets.set(key, found)
    return found
  }

  const fixes: NameFix[] = []
  for (const p of plants) {
    const changes: NameChange[] = []
    const fixList = (list: string[] = []) =>
      list.map((raw) => {
        const name = raw.trim()
        if (!name) return name
        const target = targetOf(nameKey(name))
        if (!target || target.to === name) return name
        if (!changes.some((c) => c.from === name)) changes.push({ from: name, ...target })
        return target.to
      })
    const parents = fixList(p.parents)
    const baseParents = p.base ? fixList(p.base.parents) : undefined
    if (changes.length === 0) continue
    fixes.push({
      id: p.id,
      slug: p.slug,
      name: p.name.uk,
      changes,
      parents,
      ...(p.base && baseParents ? { base: { ...p.base, parents: baseParents } } : {}),
    })
  }
  return fixes.sort((a, b) => a.name.localeCompare(b.name))
}
