import { useMemo } from 'react'
import { nameKey, parseForms, withForms, withoutStates } from '../../lib/plantName'
import { PLANT_CATEGORY, STATE_TAGS } from '../../lib/plants'
import type { Product } from '../../lib/types'
import { planCultivarFixes, type CultivarFix } from './cultivarFixes'
import { planFormFixes, type FormFix } from './formFixes'
import { planNameFixes, type LineageChange, type NameChange } from './nameFixes'
import { useFixDismissals, useOriginChecks } from './api'
import { rowFromCells, type CheckRow } from './originCheck'
import { caseName, normalizeName, planDataRules, type DataChoices, type DataRule, type DataSuggestion } from './dataRules'

/**
 * «Інструменти → Виправлення»: усі правила разом (колишні вкладки «Форми», «Назви батьків», «Культивари»
 * і нове «Інші назви для форм»). Для кожної рослини — список пропозицій, кожну можна прийняти окремо
 * або позначити «Неактуально» (зберігається в fixDismissals; змінилась пропозиція — з'явиться знову).
 */

const FIX_RULES = ['form', 'selection', 'breeder', 'aliases', 'aliasGenus', 'names', 'lineage', 'cultivar', 'quotes'] as const
export type Rule = (typeof FIX_RULES)[number] | DataRule
/** Порядок показу: спершу назва, далі форми, інші назви, батьки й походження, наприкінці — порядок у магазині */
export const RULES: Rule[] = [
  'genusField',
  'quoteName',
  'speciesCase',
  'nameStyle',
  'formTags',
  'quotes',
  'cultivar',
  'form',
  'selection',
  'breeder',
  'breederSpelling',
  'breederCopied',
  'aliases',
  'aliasGenus',
  'aliasSelf',
  'aliasShared',
  'names',
  'fromSpelling',
  'lineage',
  'selfParent',
  'originMissing',
  'originConflict',
  'habitat',
  'habitatSpelling',
  'shopReady',
  'slugGenus',
]

/** У якому порядку зливати зміни однієї рослини, якщо прийнято кілька: пізніші перекривають ті самі поля */
const APPLY_ORDER: Rule[] = ['genusField', 'names', 'lineage', 'selfParent', 'originConflict', 'habitat', 'habitatSpelling', 'cultivar', 'quotes', 'formTags', 'quoteName', 'speciesCase', 'nameStyle', 'form', 'selection', 'breeder', 'breederSpelling', 'breederCopied', 'aliasGenus', 'aliases', 'aliasSelf']

export interface Suggestion {
  /** «товар__правило» — і ключ галочки, і документ «Неактуально» */
  id: string
  productId: string
  rule: Rule
  /** Відбиток саме цієї пропозиції */
  sig: string
  /** Що записати в товар; null — лише підказка (виправляє продавець у картці або «Неактуально») */
  patch: Record<string, unknown> | null
  /** Нові правила (dataRules.ts): рядки «Було → Стане» чи пояснення, вибір варіанта */
  lines?: DataSuggestion['lines']
  choice?: DataSuggestion['choice']
  nameStates?: DataSuggestion['nameStates']
  caseCtx?: DataSuggestion['caseCtx']
  /** Позначено «Неактуально»: лишається в списку сірим, без галочки, позначку можна зняти */
  dismissed?: boolean
  form?: FormFix
  breeder?: { name: string; from: string }
  aliases?: { add: string[]; from: string; result: string[] }
  /** Рід рослини прибирається з інших назв: що на що змінюється й рід (щоб застосувати й разом із «Інші назви») */
  aliasGenus?: { genus: string; changes: { from: string; to: string }[]; result: string[] }
  names?: NameChange[]
  lineage?: LineageChange
  cultivar?: CultivarFix
}

export interface PlantSuggestions {
  id: string
  slug: string
  name: string
  image?: string
  items: Suggestion[]
}

type Plant = Product

/** Рід рослини: поле «Рід» або перше слово назви */
const genusOf = (p: Plant) => (p.genus || p.name.uk.trim().split(/s+/)[0] || '').trim()
/** «Echeveria Lola» у рослини роду Echeveria → «Lola»; інший рід («Graptoveria Lola») лишається */
export function stripGenus(alias: string, genus: string): string {
  const a = alias.trim()
  return genus && a.toLowerCase().startsWith(`${genus.toLowerCase()} `) ? a.slice(genus.length).trim() : a
}
/** Без порожніх і повторів (без різниці у великих літерах) */
const uniq = (list: string[]) => {
  const seen = new Set<string>()
  return list.filter((a) => a && !seen.has(a.toLowerCase()) && seen.add(a.toLowerCase()))
}

const hasForms = (p: Plant) => !!p.tags?.some((t) => STATE_TAGS.includes(t)) || parseForms(p.name.uk).states.some((s) => STATE_TAGS.includes(s))

/**
 * Інші назви звичайної версії — і її формам: «Sedum morganianum» (Ослячий хвіст) → «Sedum morganianum variegata».
 * Додаються лише ті, яких у форми ще немає (без різниці у великих літерах); наявні лишаються.
 */
function planAliasFixes(plants: Plant[]) {
  const cards = new Map<string, Plant>()
  for (const p of plants) if (!hasForms(p) && !cards.has(nameKey(p.name.uk))) cards.set(nameKey(p.name.uk), p)
  const out: { p: Plant; add: string[]; from: string; result: string[] }[] = []
  for (const p of plants) {
    if (!hasForms(p)) continue
    const card = cards.get(nameKey(withoutStates(p.name.uk)))
    const theirs = (card?.aliases ?? []).map((a) => a.trim()).filter(Boolean)
    if (!card || theirs.length === 0) continue
    const mine = (p.aliases ?? []).map((a) => a.trim()).filter(Boolean)
    // Порівнюємо й без роду: «Echeveria Тестова» і «Тестова» в рослини роду Echeveria — та сама назва
    const g = genusOf(p)
    const keyOf = (a: string) => stripGenus(a, g).toLowerCase()
    const have = new Set([...mine, p.name.uk].map(keyOf))
    const add = theirs.filter((a) => !have.has(keyOf(a)) && have.add(keyOf(a)))
    if (add.length) out.push({ p, add, from: card.name.uk, result: [...mine, ...add] })
  }
  return out
}

export function planAllFixes(
  products: Product[],
  checks: readonly CheckRow[],
  choices: { names?: ReadonlyMap<string, string>; lineage?: ReadonlyMap<string, string> } & DataChoices = {},
): PlantSuggestions[] {
  const plants = products.filter((p) => p.category === PLANT_CATEGORY)
  // Порядок у магазині й опис — для всіх товарів, решта правил — лише для рослин
  const byId = new Map(products.map((p) => [p.id, p]))
  const all: Suggestion[] = []
  const add = (productId: string, rule: Rule, sig: string, patch: Record<string, unknown> | null, extra: Partial<Suggestion>) =>
    all.push({ id: `${productId}__${rule}`, productId, rule, sig, patch, ...extra })

  for (const f of planFormFixes(plants).fixes) {
    if (!f.originOk) {
      const rule = f.kind === 'selection' ? 'selection' : 'form'
      add(f.id, rule, f.source, { origin: 'cultivar', parents: [f.source], habitat: '' }, { form: f })
    }
    // Селекціонера звичайної версії формам більше не копіюємо (форму міг вивести інший) — він видно в блоці «Від …»
  }
  for (const a of planAliasFixes(plants)) add(a.p.id, 'aliases', a.add.join('|'), { aliases: a.result }, { aliases: { add: a.add, from: a.from, result: a.result } })
  // Рід у інших назвах: «Echeveria Lola» в рослини роду Echeveria → «Lola» (рід і так видно в назві); інший рід лишається
  for (const p of plants) {
    const genus = genusOf(p)
    const mine = (p.aliases ?? []).map((a) => a.trim()).filter(Boolean)
    const changes = mine.map((a) => ({ from: a, to: stripGenus(a, genus) })).filter((c) => c.from !== c.to)
    if (!genus || changes.length === 0) continue
    const result = uniq(mine.map((a) => stripGenus(a, genus)))
    add(p.id, 'aliasGenus', result.join('|'), { aliases: result }, { aliasGenus: { genus, changes, result } })
  }
  for (const n of planNameFixes(plants, choices.names, checks, choices.lineage)) {
    if (n.changes.length)
      add(n.id, 'names', n.changes.map((c) => `${c.from}>${c.to}`).join('|'), { parents: n.parents, ...(n.base ? { base: n.base } : {}) }, { names: n.changes })
    const l = n.lineage
    if (l) {
      // «Неактуально» — про саму розбіжність, а не про вибраний варіант: відбиток — що було й які варіанти відомі
      const sig = [l.target, JSON.stringify(l.from), ...(l.variants ?? [{ sig: l.sig }]).map((v) => v.sig).sort()].join('|')
      const patch =
        l.target === 'base'
          ? { base: l.to }
          : { origin: l.to.origin, parents: l.to.parents, habitat: l.to.origin === 'natural' ? (l.to.habitat ?? '') : '' }
      add(n.id, 'lineage', sig, patch, { lineage: l })
    }
  }
  for (const c of planCultivarFixes(plants)) {
    if (!c.cultivarSet) add(c.id, 'cultivar', c.cultivar, { cultivarName: c.cultivar }, { cultivar: c })
    if (c.rename)
      add(c.id, 'quotes', c.rename.name, { 'name.uk': c.rename.name, cultivarName: c.cultivar, ...(c.rename.parents ? { parents: c.rename.parents } : {}) }, { cultivar: c })
  }

  // Правила порядку й однаковості даних; підказку «гібрид без батьків» / «відбір без Від» не дублюємо,
  // якщо для рослини вже є пропозиція походження чи форми
  const has = (id: string, rules: Rule[]) => all.some((x) => x.productId === id && rules.includes(x.rule))
  for (const d of planDataRules(products, checks, choices)) {
    if (d.rule === 'originConflict' && !d.patch && has(d.productId, ['lineage', 'form', 'selection'])) continue
    // Походження вже пропонує інше правило (з карток форм чи перевірки) — «Немає походження» не дублюємо
    if (d.rule === 'originMissing' && has(d.productId, ['lineage', 'form', 'selection'])) continue
    // Одна пропозиція одного правила на товар (напр. ареал і ареал у «Походженні» форми — разом)
    const prev = all.find((x) => x.productId === d.productId && x.rule === d.rule)
    if (prev) {
      prev.lines = [...(prev.lines ?? []), ...d.lines]
      prev.sig = `${prev.sig}||${d.sig}`
      prev.patch = prev.patch || d.patch ? { ...(prev.patch ?? {}), ...(d.patch ?? {}) } : null
      continue
    }
    add(d.productId, d.rule, d.sig, d.patch, { lines: d.lines, choice: d.choice, nameStates: d.nameStates, caseCtx: d.caseCtx })
  }

  const groups = new Map<string, PlantSuggestions>()
  for (const s of all) {
    const p = byId.get(s.productId)
    if (!p) continue
    const g = groups.get(p.id) ?? { id: p.id, slug: p.slug, name: p.name.uk, image: p.images?.[0], items: [] }
    g.items.push(s)
    groups.set(p.id, g)
  }
  for (const g of groups.values()) g.items.sort((a, b) => RULES.indexOf(a.rule) - RULES.indexOf(b.rule))
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name))
}

/** Прийняті пропозиції однієї рослини → одна зміна товару (пізніші правила перекривають ті самі поля). */
export function mergePatches(items: Suggestion[], product?: Product): Record<string, unknown> {
  const merged: Record<string, unknown> = [...items]
    .sort((a, b) => APPLY_ORDER.indexOf(a.rule) - APPLY_ORDER.indexOf(b.rule))
    .reduce((acc, s) => ({ ...acc, ...(s.patch ?? {}) }), {})
  const pick = (rule: Rule) => items.find((s) => s.rule === rule)
  // Назву змінюють кілька правил — складаємо по черзі: злиті лапки → форми з галочок → однакове написання
  const quotes = pick('quotes')?.cultivar?.rename?.name
  const forms = pick('formTags')
  const formsName = !!forms?.patch && 'name.uk' in forms.patch
  const style = pick('nameStyle')
  const cased = pick('quoteName') ?? pick('speciesCase')
  if (product && (quotes || formsName || style || cased)) {
    let name = quotes ?? product.name.uk
    if (formsName && forms?.nameStates) name = withForms(parseForms(name).base, forms.nameStates)
    if (cased?.caseCtx) name = caseName(name, cased.caseCtx)
    if (style) name = normalizeName(name)
    merged['name.uk'] = name
  }
  // Інші назви теж — по черзі: додати від звичайної версії → прибрати рід → прибрати саму назву рослини
  const added = pick('aliases')?.aliases?.result
  const genus = pick('aliasGenus')?.aliasGenus?.genus
  const self = pick('aliasSelf')
  if (product && (added || genus || self)) {
    let list = added ?? product.aliases ?? []
    if (genus) list = list.map((a) => stripGenus(a, genus))
    const finalName = typeof merged['name.uk'] === 'string' ? (merged['name.uk'] as string) : product.name.uk
    if (self) list = list.filter((a) => nameKey(a) !== nameKey(finalName) && nameKey(a) !== nameKey(product.name.uk))
    merged.aliases = uniq(list.map((a) => a.trim()))
  }
  return merged
}

/** Пропозиції всіх правил разом; «Неактуально» — у базі, тож не з'являється знову (поки пропозиція та сама). */
const NO_CHOICES = {}
export function useFixPlan(products: Product[] | undefined, choices: Parameters<typeof planAllFixes>[2] = NO_CHOICES) {
  const { data: checks } = useOriginChecks()
  const { data: dismissals } = useFixDismissals()
  return useMemo(() => {
    const rows = (checks ?? []).map((c) => rowFromCells(c.cells))
    const dismissed = new Map((dismissals ?? []).map((d) => [d.id, d.sig]))
    const plants = products ? planAllFixes(products, rows, choices) : []
    const isDismissed = (s: Suggestion) => dismissed.get(s.id) === s.sig
    const split = (wantDismissed: boolean) =>
      plants.map((g) => ({ ...g, items: g.items.filter((s) => isDismissed(s) === wantDismissed) })).filter((g) => g.items.length > 0)
    // all — усі пропозиції на своїх місцях, неактуальні з позначкою dismissed
    const all = plants.map((g) => ({ ...g, items: g.items.map((s) => (isDismissed(s) ? { ...s, dismissed: true } : s)) }))
    return { active: split(false), dismissed: split(true), all }
  }, [products, checks, dismissals, choices])
}
