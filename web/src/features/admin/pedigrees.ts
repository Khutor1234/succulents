import { baseKey, familyKey, makeNameResolver, nameKey } from '../../lib/plantName'
import { PLANT_CATEGORY, STATE_TAGS } from '../../lib/plants'
import type { Product } from '../../lib/types'

/**
 * Підбірки для сторінки «Родоводи» (лише для продавця): що з колекції пов'язане між собою.
 * - трійки: є і дитина, і обидва батьки;
 * - пари: є дитина й лише один із батьків;
 * - форми: та сама рослина в кількох формах (звичайна, variegata, cristata…), разом із її культиварами й «hybrid»
 *   («Echeveria chihuahuaensis», «… 'Ruby Blush'», «… variegata»; «Orion» і «Orion hybrid») — lib/plantName: familyKey;
 * - нащадки: рослина-батько й усі її діти з колекції.
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
/** Рослина-батько й усі її відомі діти з колекції. */
export interface Family {
  parent: Product
  /** Та сама рослина-батько в інших формах (variegata, cristata…) — мутації від неї, тож вона їм теж «батько» */
  parentForms: Product[]
  children: {
    child: Product
    /** Як записаний другий батько (або порожньо). Хто з двох мама, а хто тато, — часто невідомо, тож не показуємо */
    other: string
    /** Дитина в інших формах */
    forms: Product[]
  }[]
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
  // Родина: рослина, її форми, культивари й «hybrid» — спершу сама рослина, далі за кількістю форм і назвою
  const plainFirst = (a: Product, b: Product) =>
    Number(nameKey(b.name.uk) === familyKey(b.name.uk)) - Number(nameKey(a.name.uk) === familyKey(a.name.uk)) ||
    forms(a).length - forms(b).length ||
    a.name.uk.localeCompare(b.name.uk)
  const byFamily = new Map<string, Product[]>()
  for (const p of plants) {
    const k = familyKey(p.name.uk)
    byFamily.set(k, [...(byFamily.get(k) ?? []), p])
  }
  for (const list of byFamily.values()) list.sort((a, b) => better(a, b) || plainFirst(a, b))
  // Інші рослини тієї самої родини (по одній на кожну назву): для «Lola» — «Lola variegata», «Lola cristata»,
  // для chihuahuaensis — ще й «chihuahuaensis 'Ruby Blush'»
  const formsOf = (p: Product) => {
    const taken = new Set([nameKey(p.name.uk)])
    return (byFamily.get(familyKey(p.name.uk)) ?? []).filter((x) => {
      const k = nameKey(x.name.uk)
      if (taken.has(k)) return false
      taken.add(k)
      return true
    })
  }
  // Батько — лише в тій самій формі, що й дитина (точний збіг фенотипу): звичайна дитина — від звичайних батьків.
  // Записано «Lola», а в колекції лише «Lola variegata» — такого батька в колекції немає.
  const sameForms = (a: Product, b: Product) => forms(a).join('+') === forms(b).join('+')
  const find = (name: string, child: Product) => byKey.get(resolve(name))?.find((p) => sameForms(p, child))

  const trios: Trio[] = []
  const pairs: Pair[] = []
  const families = new Map<string, Family>()
  // Та сама трійка/пара для різних форм дитини (Lola й Lola variegata з тими самими батьками) — показуємо раз
  const seen = new Set<string>()
  for (const child of [...plants].sort(better)) {
    // Мутація (відбір) — це форма своєї рослини, її показує вкладка «Форми»
    if (child.origin === 'cultivar') continue
    const names = (child.parents ?? []).map((x) => x.trim()).filter(Boolean)
    if (names.length === 0) continue
    const found = names.map((n) => find(n, child))
    const sig = `${baseKey(child.name.uk)}|${names.map((n) => resolve(n)).sort().join('|')}`
    if (seen.has(sig)) continue
    // «Нащадки»: дитина — до кожного батька, який є в колекції
    found.forEach((parent, i) => {
      if (!parent || parent.id === child.id) return
      const family = families.get(parent.id) ?? { parent, parentForms: formsOf(parent), children: [] }
      family.children.push({ child, other: names.length === 2 ? names[1 - i] : '', forms: formsOf(child) })
      families.set(parent.id, family)
    })
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
  for (const items of byFamily.values()) {
    // Потрібні справді різні рослини родини, а не просто кілька однакових товарів
    if (new Set(items.map((p) => nameKey(p.name.uk))).size < 2) continue
    const sorted = [...items].sort(plainFirst)
    formGroups.push({ name: sorted[0].name.uk, items: sorted })
  }

  const byName = (a: { child: Product } | FormGroup, b: { child: Product } | FormGroup) =>
    ('child' in a ? a.child.name.uk : a.name).localeCompare('child' in b ? b.child.name.uk : b.name)
  // Спершу ті, в кого найбільше дітей; діти — за абеткою
  const familyList = [...families.values()]
    .map((f) => ({ ...f, children: f.children.sort((a, b) => a.child.name.uk.localeCompare(b.child.name.uk)) }))
    .sort((a, b) => b.children.length - a.children.length || a.parent.name.uk.localeCompare(b.parent.name.uk))
  return { trios: trios.sort(byName), pairs: pairs.sort(byName), formGroups: formGroups.sort(byName), families: familyList }
}
