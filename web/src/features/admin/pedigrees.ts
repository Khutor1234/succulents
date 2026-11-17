import { baseKey, familyKey, familyName, makeNameResolver, nameKey } from '../../lib/plantName'
import { PLANT_CATEGORY, STATE_TAGS } from '../../lib/plants'
import type { Product } from '../../lib/types'

/**
 * Підбірки для сторінки «Родоводи» (лише для продавця): що з колекції пов'язане між собою.
 * - трійки: усі відомі «мама × тато → дитина» — і з рослинами, яких у магазині немає (тоді лише назва);
 * - форми: та сама рослина в кількох формах (звичайна, variegata, cristata…), разом із її культиварами й «hybrid»
 *   («Echeveria chihuahuaensis», «… 'Ruby Blush'», «… variegata»; «Orion» і «Orion hybrid») — lib/plantName: familyKey;
 * - нащадки: рослина-батько й усі її діти з колекції.
 * Назви батьків зіставляються з товарами без огляду на лапки, регістр і дрібні описки (lib/plantName).
 */
/** Рослина в трійці: товар з магазину або лише назва (такої рослини в магазині немає). */
export interface PlantNode {
  name: string
  product?: Product
}
export interface Trio {
  key: string
  child: PlantNode
  parents: [PlantNode, PlantNode]
}
export interface FormGroup {
  name: string
  items: Product[]
}
/** Рослина-батько й усі її відомі діти з колекції. */
export interface Family {
  parent: Product
  children: {
    child: Product
    /** Як записаний другий батько (або порожньо). Хто з двох мама, а хто тато, — часто невідомо, тож не показуємо */
    other: string
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
  // Батько — лише в тій самій формі, що й дитина (точний збіг фенотипу): звичайна дитина — від звичайних батьків.
  // Записано «Lola», а в колекції лише «Lola variegata» — такого батька в колекції немає.
  const formSig = (p: Product) => forms(p).join('+')
  const find = (name: string, child: Product | string) =>
    byKey.get(resolve(name))?.find((p) => formSig(p) === (typeof child === 'string' ? child : formSig(child)))
  const node = (name: string, product?: Product): PlantNode => ({ name: product?.name.uk ?? name, product })

  const trios: Trio[] = []
  const families = new Map<string, Family>()
  // Та сама трійка для різних форм дитини (Lola й Lola variegata з тими самими батьками) — показуємо раз
  const seen = new Set<string>()
  const trioSig = (child: string, names: string[]) => `${baseKey(child)}|${names.map((n) => resolve(n)).sort().join('|')}`
  // Спершу звичайні форми: трійку «Lola» з батьками показуємо замість такої ж «Lola variegata»
  for (const child of [...plants].sort((a, b) => forms(a).length - forms(b).length || better(a, b))) {
    // Мутація (відбір) — це форма своєї рослини, її показує вкладка «Форми»
    if (child.origin === 'cultivar') continue
    const names = (child.parents ?? []).map((x) => x.trim()).filter(Boolean)
    if (names.length === 0) continue
    const found = names.map((n) => find(n, child))
    const sig = trioSig(child.name.uk, names)
    if (seen.has(sig)) continue
    seen.add(sig)
    // «Нащадки»: дитина — до кожного батька, який є в колекції
    found.forEach((parent, i) => {
      if (!parent || parent.id === child.id) return
      const family = families.get(parent.id) ?? { parent, children: [] }
      family.children.push({ child, other: names.length === 2 ? names[1 - i] : '' })
      families.set(parent.id, family)
    })
    // Трійка — коли записані обидва батьки, навіть якщо їх (чи когось одного) у магазині немає
    if (names.length === 2 && found.every((p) => p?.id !== child.id)) {
      trios.push({ key: sig, child: node(child.name.uk, child), parents: [node(names[0], found[0]), node(names[1], found[1])] })
    }
  }
  // Походження звичайної версії з картки форми: «Lola variegata» — від «Lola», а та — lilacina × derenbergii.
  // Самої «Lola» в магазині може й не бути — тоді трійка з її назвою.
  for (const p of [...plants].sort(better)) {
    const plain = p.parents?.[0]?.trim()
    const names = (p.base?.origin === 'hybrid' ? p.base.parents : []).map((x) => x.trim()).filter(Boolean)
    if (p.origin !== 'cultivar' || !plain || names.length !== 2) continue
    const sig = trioSig(plain, names)
    if (seen.has(sig)) continue
    seen.add(sig)
    trios.push({ key: sig, child: node(plain, find(plain, '')), parents: [node(names[0], find(names[0], '')), node(names[1], find(names[1], ''))] })
  }

  const formGroups: FormGroup[] = []
  for (const items of byFamily.values()) {
    // Потрібні справді різні рослини родини, а не просто кілька однакових товарів
    if (new Set(items.map((p) => nameKey(p.name.uk))).size < 2) continue
    const sorted = [...items].sort(plainFirst)
    // Заголовок — сама рослина без форм, культивару й hybrid: «Echeveria chihuahuaensis», а не «… 'Ruby Blush'»
    formGroups.push({ name: familyName(sorted[0].name.uk), items: sorted })
  }

  const byName = (a: FormGroup, b: FormGroup) => a.name.localeCompare(b.name)
  // Трійки: спершу повні (усі троє в магазині), далі — за назвою дитини
  const missing = (x: Trio) => [x.child, ...x.parents].filter((n) => !n.product).length
  const trioOrder = (a: Trio, b: Trio) => missing(a) - missing(b) || a.child.name.localeCompare(b.child.name)
  // Спершу ті, в кого найбільше дітей; діти — за абеткою
  const familyList = [...families.values()]
    .map((f) => ({ ...f, children: f.children.sort((a, b) => a.child.name.uk.localeCompare(b.child.name.uk)) }))
    .sort((a, b) => b.children.length - a.children.length || a.parent.name.uk.localeCompare(b.parent.name.uk))
  return { trios: trios.sort(trioOrder), formGroups: formGroups.sort(byName), families: familyList }
}
