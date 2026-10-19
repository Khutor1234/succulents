import { baseKey, makeNameResolver, nameKey } from '../../lib/plantName'
import { PLANT_CATEGORY, STATE_TAGS } from '../../lib/plants'
import type { Product } from '../../lib/types'

/**
 * Підбірки для сторінки «Родоводи» (лише для продавця): що з колекції пов'язане між собою.
 * - трійки: є і дитина, і обидва батьки;
 * - пари: є дитина й лише один із батьків;
 * - форми: та сама рослина в кількох формах (звичайна, variegata, cristata…).
 * Назви батьків зіставляються з товарами без огляду на лапки, регістр і дрібні описки (lib/plantName).
 */
export interface Trio {
  child: Product
  parents: [Product, Product]
}
export interface Pair {
  child: Product
  parent: Product
  /** Як записаний другий батько, якого в колекції немає (або порожньо) */
  other: string
}
export interface FormGroup {
  name: string
  items: Product[]
}

const forms = (p: Product) => STATE_TAGS.filter((t) => p.tags?.includes(t))
// Серед однакових назв — спершу показаний товар і звичайна форма
const better = (a: Product, b: Product) => Number(b.isActive) - Number(a.isActive) || forms(a).length - forms(b).length

export function buildPedigrees(products: Product[]) {
  const plants = products.filter((p) => p.category === PLANT_CATEGORY)
  const byKey = new Map<string, Product[]>()
  for (const p of plants) {
    const k = nameKey(p.name.uk)
    byKey.set(k, [...(byKey.get(k) ?? []), p])
  }
  for (const list of byKey.values()) list.sort(better)
  const resolve = makeNameResolver([...byKey.keys()])
  const byBase = new Map<string, Product[]>()
  for (const p of plants) {
    const k = baseKey(p.name.uk)
    byBase.set(k, [...(byBase.get(k) ?? []), p])
  }
  for (const list of byBase.values()) list.sort(better)
  // Батько записаний без форми, а в колекції є лише його variegata/cristata — теж рахуємо
  const find = (name: string) => byKey.get(resolve(name))?.[0] ?? byBase.get(baseKey(name))?.[0]

  const trios: Trio[] = []
  const pairs: Pair[] = []
  // Та сама трійка/пара для різних форм дитини (Lola й Lola variegata з тими самими батьками) — показуємо раз
  const seen = new Set<string>()
  for (const child of [...plants].sort(better)) {
    // Мутація (відбір) — це форма своєї рослини, її показує вкладка «Форми»
    if (child.origin === 'cultivar') continue
    const names = (child.parents ?? []).map((x) => x.trim()).filter(Boolean)
    if (names.length === 0) continue
    const found = names.map((n) => find(n))
    const sig = `${baseKey(child.name.uk)}|${names.map((n) => resolve(n)).sort().join('|')}`
    if (seen.has(sig)) continue
    if (found.length === 2 && found[0] && found[1] && found[0].id !== child.id && found[1].id !== child.id) {
      seen.add(sig)
      trios.push({ child, parents: [found[0], found[1]] })
    } else {
      const i = found.findIndex((p) => p && p.id !== child.id)
      if (i < 0) continue
      seen.add(sig)
      pairs.push({ child, parent: found[i]!, other: names.length === 2 ? names[1 - i] : '' })
    }
  }

  const formGroups: FormGroup[] = []
  for (const items of byBase.values()) {
    // Потрібні справді різні форми, а не просто кілька однакових товарів
    if (new Set(items.map((p) => forms(p).join('+'))).size < 2) continue
    const sorted = [...items].sort((a, b) => forms(a).length - forms(b).length || a.name.uk.localeCompare(b.name.uk))
    formGroups.push({ name: sorted[0].name.uk, items: sorted })
  }

  const byName = (a: { child: Product } | FormGroup, b: { child: Product } | FormGroup) =>
    ('child' in a ? a.child.name.uk : a.name).localeCompare('child' in b ? b.child.name.uk : b.name)
  return { trios: trios.sort(byName), pairs: pairs.sort(byName), formGroups: formGroups.sort(byName) }
}
