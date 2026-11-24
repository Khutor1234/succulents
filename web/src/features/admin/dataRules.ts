import { detectGenus, familyKey, nameKey, parseForms, withForms, withoutStates } from '../../lib/plantName'
import { NAME_TAGS, PLANT_CATEGORY, STATE_TAGS, type PlantTag } from '../../lib/plants'
import { sourceNameOf } from '../../lib/search'
import { slugify } from '../../lib/slug'
import { HABITATS, type Product } from '../../lib/types'
import type { CheckRow } from './originCheck'

/**
 * Правила порядку й однаковості даних для «Інструменти → Виправлення» (поруч із allFixes.ts).
 * Кожне правило лише пропонує: зміна (patch) записується, тільки коли продавець поставить галочку й натисне «Застосувати».
 * Правила без patch — лише підказка (напр. можливий дубль): виправляє продавець у картці, або «Неактуально».
 */

export const DATA_RULES = [
  'genusField',
  'nameStyle',
  'formTags',
  'aliasSelf',
  'aliasShared',
  'selfParent',
  'originConflict',
  'habitat',
  'habitatSpelling',
  'breederSpelling',
  'breederCopied',
  'shopReady',
  'slugGenus',
  'quoteName',
  'speciesCase',
  'originMissing',
  'fromSpelling',
  'slugForm',
  'baseFromName',
] as const
export type DataRule = (typeof DATA_RULES)[number]

/** Рядок «Було → Стане» або просто пояснення (note) */
export interface FixLine {
  from?: string
  to?: string
  note?: string
}

export interface DataSuggestion {
  productId: string
  rule: DataRule
  sig: string
  /** null — лише підказка, без автоматичної зміни */
  patch: Record<string, unknown> | null
  lines: FixLine[]
  /** Написано по-різному — продавець вибирає правильний варіант (діє на всі картки з цим написанням) */
  choice?: { kind: 'breeder'; key: string; options: string[]; value: string }
  /** Для злиття з іншими змінами назви: якими мають бути форми в назві (formTags) */
  nameStates?: PlantTag[]
  /** aliasSelf: яку назву прибрати з інших назв */
  dropAlias?: string
  /** quoteName / speciesCase: як писати назву (щоб застосувати й разом з іншими змінами назви) */
  caseCtx?: CaseCtx
}

export interface DataChoices {
  breeders?: ReadonlyMap<string, string>
}

const name0 = (p: Product) => p.name.uk
const QUOTES = /[‘’‚‛“”„"«»`ʼ′]/g
const uniqCI = (list: string[]) => {
  const seen = new Set<string>()
  return list.filter((a) => a && !seen.has(a.toLowerCase()) && seen.add(a.toLowerCase()))
}

/**
 * Однакове написання назви: без зайвих пробілів, рід латиною з великої («ехеверія», «echeveria» → «Echeveria»),
 * прямі лапки ('Lola' замість ‘Lola’, «Lola», "Lola"), знак схрещування × замість x між назвами,
 * форми одним словом («variegated», «f. Variegata» → «variegata»).
 */
/**
 * Як писати назву за ботанічними правилами: природний вид — з малої літери («Echeveria agavoides»),
 * гібрид і культивар — у лапках («Echeveria 'Lola'», «Echeveria agavoides 'Maria'»).
 * species — слова виду, від якого ця рослина (для відбору чи форми виду): їх лишаємо з малої, решту — у лапки.
 */
export interface CaseCtx {
  /** natural — увесь вид з малої; quote — назва гібрида/культивару в лапках */
  mode: 'natural' | 'quote'
  /** Слова виду-джерела з малої (для «agavoides Maria» → «agavoides 'Maria'») */
  species: string[]
}

export function caseName(name: string, ctx: CaseCtx): string {
  const { base, states } = parseForms(name.replace(/\s+/g, ' ').trim())
  const words = base.split(' ')
  if (words.length < 2) return name
  const [genus, ...rest] = words
  // Лапки вже є, формула схрещування («Romeo x Rubin») чи службові слова — не чіпаємо
  if (rest.some((w) => /['‘’"«»]/.test(w) || /^(x|×|hybrid|subsp\.?|var\.?|f\.?|ssp\.?)$/i.test(w))) return name
  let out: string[]
  if (ctx.mode === 'natural') out = rest.map((w) => w.toLowerCase())
  else {
    // Спершу слова виду (з малої), далі — назва в лапках
    let i = 0
    while (i < rest.length && (ctx.species[i] ? rest[i].toLowerCase() === ctx.species[i] : /^\p{Ll}/u.test(rest[i]))) i++
    const head = rest.slice(0, i).map((w) => w.toLowerCase())
    const tail = rest.slice(i)
    out = tail.length ? [...head, `'${tail.join(' ')}'`] : head
  }
  const result = withForms([genus, ...out].join(' '), states)
  return result
}

const NAME_STEPS: [string, (n: string) => string][] = [
  ['spaces', (n) => n.replace(/\s+/g, ' ').trim()],
  ['quotes', (n) => n.replace(QUOTES, "'")],
  ['cross', (n) => n.replace(/(\S) [xX] (?=\S)/g, '$1 × ')],
  [
    'genus',
    (n) => {
      const genus = detectGenus(n)
      return genus ? [genus, ...n.split(' ').slice(1)].join(' ') : n
    },
  ],
  [
    'forms',
    (n) => {
      const { base, states } = parseForms(n)
      return states.length ? withForms(base, states) : n
    },
  ],
]

export function normalizeName(name: string): string {
  return NAME_STEPS.reduce((n, [, step]) => step(n), name)
}

/** Що саме змінить normalizeName — для пояснення під пропозицією */
function nameStyleReasons(from: string): string[] {
  const reasons: string[] = []
  let n = from
  for (const [id, step] of NAME_STEPS) {
    const next = step(n)
    if (next !== n) reasons.push(id)
    n = next
  }
  return reasons
}

/** Країна ареалу однаково: як у списку форми товару (HABITATS); англійські й інші написання → українською */
const HABITAT_ALIASES: Record<string, (typeof HABITATS)[number]> = {
  mexico: 'Мексика',
  méxico: 'Мексика',
  'south africa': 'ПАР',
  rsa: 'ПАР',
  'південна африка': 'ПАР',
  'південно-африканська республіка': 'ПАР',
  namibia: 'Намібія',
  madagascar: 'Мадагаскар',
  'canary islands': 'Канарські острови',
  canaries: 'Канарські острови',
  канари: 'Канарські острови',
  usa: 'США',
  'united states': 'США',
  peru: 'Перу',
  chile: 'Чилі',
  bolivia: 'Болівія',
  brazil: 'Бразилія',
  yemen: 'Ємен',
  china: 'Китай',
}
export function normalizeHabitat(text: string): string {
  const t = text.replace(/\s+/g, ' ').trim()
  const low = t.toLowerCase().replace(/\.$/, '')
  return HABITATS.find((h) => h.toLowerCase() === low) ?? HABITAT_ALIASES[low] ?? t
}

/** Селекціонер: «Dick Wright», «D. Wright», «dick wright» → один ключ (прізвище + перша літера імені) */
function breederKey(name: string): string {
  const words = name.toLowerCase().replace(/[.,]/g, ' ').split(/\s+/).filter(Boolean)
  if (words.length === 0) return ''
  if (words.length === 1) return words[0]
  return `${words[words.length - 1]} ${words[0][0]}`
}

export function planDataRules(products: Product[], checks: readonly CheckRow[], choices: DataChoices = {}): DataSuggestion[] {
  const out: DataSuggestion[] = []
  const add = (s: DataSuggestion) => out.push(s)
  const plants = products.filter((p) => p.category === PLANT_CATEGORY)
  const byKey = new Map(plants.map((p) => [nameKey(p.name.uk), p]))
  const familyOf = (p: Product) => nameKey(withoutStates(p.name.uk))

  for (const p of plants) {
    const name = p.name.uk

    // 1. Рід у назві й у полі «Рід» мають збігатися — інакше рослина в чужому фільтрі й родоводах
    const g = detectGenus(name)
    if (g && g !== (p.genus ?? '')) {
      add({ productId: p.id, rule: 'genusField', sig: g, patch: { genus: g }, lines: [{ from: p.genus || '—', to: g }] })
    } else if (!g && p.genus) {
      const first = name.trim().split(/\s+/)[0] ?? ''
      if (first.replace(QUOTES, '').toLowerCase() !== p.genus.toLowerCase())
        add({ productId: p.id, rule: 'genusField', sig: `${first}|${p.genus}`, patch: null, lines: [{ note: `«${first}» ≠ «${p.genus}»` }] })
    }

    // Назва гібрида чи культивару — у лапках; природний вид — з малої літери (ботанічні правила)
    {
      const sourceName = sourceNameOf(p)
      const source = sourceName ? byKey.get(nameKey(sourceName)) : undefined
      const sourceNatural = p.base?.origin === 'natural' || source?.origin === 'natural'
      const words = parseForms(name).base.split(/\s+/)
      const genusOk = !!words[0] && (detectGenus(words[0]) || words[0].toLowerCase() === (p.genus ?? '').toLowerCase())
      // Форма чи відбір природного виду — слова виду з малої, решта (культивар) — у лапках
      const speciesWords =
        sourceNatural && sourceName
          ? parseForms(sourceName)
              .base.split(/\s+/)
              .slice(1)
              .map((w) => w.toLowerCase())
          : []
      const ctx: CaseCtx | null = !genusOk
        ? null
        : p.origin === 'natural'
          ? { mode: 'natural', species: [] }
          : p.origin === 'hybrid' || p.origin === 'cultivar' || (!p.origin && (p.parents ?? []).length)
            ? { mode: 'quote', species: speciesWords }
            : null
      const fixed = ctx ? caseName(name, ctx) : name
      if (ctx && fixed !== name) {
        const rule = ctx.mode === 'natural' || !/'/.test(fixed) ? 'speciesCase' : 'quoteName'
        add({ productId: p.id, rule, sig: fixed, patch: { 'name.uk': fixed }, caseCtx: ctx, lines: [{ from: name, to: fixed }] })
      }
    }

    // 2. Написання назви
    const styled = normalizeName(name)
    if (styled !== name) {
      add({
        productId: p.id,
        rule: 'nameStyle',
        sig: styled,
        patch: { 'name.uk': styled },
        lines: [{ from: name, to: styled }, { note: nameStyleReasons(name).join(',') }],
      })
    }

    // 3. Форми в назві й галочки форм мають збігатися
    const inName = parseForms(name).states
    const tagged = NAME_TAGS.filter((t) => p.tags?.includes(t))
    const missingTags = inName.filter((t) => !tagged.includes(t))
    const missingInName = tagged.filter((t) => !inName.includes(t))
    if (missingTags.length || missingInName.length) {
      const states = NAME_TAGS.filter((t) => inName.includes(t) || tagged.includes(t))
      const newName = missingInName.length ? withForms(parseForms(name).base, states) : name
      const tags = [...new Set([...(p.tags ?? []), ...missingTags])]
      const patch: Record<string, unknown> = {}
      if (missingTags.length) patch.tags = tags
      if (missingInName.length) patch['name.uk'] = newName
      add({
        productId: p.id,
        rule: 'formTags',
        sig: states.join('+'),
        patch,
        nameStates: states,
        lines: [...(missingTags.length ? [{ note: `tags:${missingTags.join(',')}` }] : []), ...(missingInName.length ? [{ from: name, to: newName }] : [])],
      })
    }

    // «Можливий дубль» (та сама назва в кількох картках) прибрано на прохання власниці: це різні екземпляри варієгатності

    // 8. Інша назва = власна назва рослини — зайва
    const self = (p.aliases ?? []).find((a) => nameKey(a) === nameKey(name))
    if (self)
      add({
        productId: p.id,
        rule: 'aliasSelf',
        sig: self,
        patch: { aliases: (p.aliases ?? []).filter((a) => a !== self) },
        dropAlias: self,
        lines: [{ from: self, to: '—' }],
      })

    // 9. Рослина — сама собі батько; або двоє записані батьками одне одного
    const own = nameKey(name)
    const parents = (p.parents ?? []).filter(Boolean)
    const selfParents = parents.filter((x) => nameKey(x) === own)
    const baseParents = (p.base?.parents ?? []).filter(Boolean)
    const baseSelf = baseParents.filter((x) => nameKey(x) === familyOf(p))
    if (selfParents.length || baseSelf.length) {
      const patch: Record<string, unknown> = {}
      if (selfParents.length) patch.parents = parents.filter((x) => nameKey(x) !== own)
      if (baseSelf.length && p.base) patch.base = { ...p.base, parents: baseParents.filter((x) => nameKey(x) !== familyOf(p)) }
      add({
        productId: p.id,
        rule: 'selfParent',
        sig: [...selfParents, ...baseSelf].join('|'),
        patch,
        lines: [...selfParents, ...baseSelf].map((x) => ({ from: x, to: '—' })),
      })
    }
    for (const x of parents) {
      const q = byKey.get(nameKey(x))
      if (q && q.id !== p.id && (q.parents ?? []).some((y) => nameKey(y) === own))
        add({ productId: p.id, rule: 'selfParent', sig: `cycle|${q.id}`, patch: null, lines: [{ note: `cycle:${q.name.uk}` }] })
    }

    // «Від» форми — та сама рослина, що й у назві, але записана інакше (інші лапки чи без них): «Echeveria Monocerotis»
    // у «Echeveria 'Monocerotis' variegata». Якщо ця рослина є в магазині — це вже правило «Назва батька».
    if (p.origin === 'cultivar' && parents[0] && (p.tags?.some((t) => STATE_TAGS.includes(t)) || parseForms(name).states.some((s) => STATE_TAGS.includes(s)))) {
      const expected = withoutStates(name).trim()
      if (nameKey(parents[0]) === nameKey(expected) && parents[0] !== expected && !byKey.has(nameKey(expected)))
        add({ productId: p.id, rule: 'fromSpelling', sig: expected, patch: { parents: [expected] }, lines: [{ from: parents[0], to: expected }] })
    }

    // Звичайної версії форми немає в магазині, а блок «Походження …» порожній — те, що видно з самої назви «Від»:
    // «Echeveria agavoides 'Maria'» — відбір від Echeveria agavoides; «Echeveria chihuahuaensis» — природний вид
    const isForm0 = !!p.tags?.some((t) => STATE_TAGS.includes(t)) || parseForms(name).states.some((s) => STATE_TAGS.includes(s))
    const baseEmpty = !p.base || (!p.base.origin && !(p.base.parents ?? []).filter(Boolean).length)
    const from0 = parents[0]?.trim() ?? ''
    if (p.origin === 'cultivar' && isForm0 && baseEmpty && from0 && !byKey.has(nameKey(from0)) && !/×|\sx\s/i.test(from0)) {
      const q = from0.search(/['‘’"]/u)
      const words = (q > 0 ? from0.slice(0, q) : from0).trim().split(/\s+/)
      const speciesOk = words.length >= 2 && words.slice(1).every((w) => /^[a-z]/.test(w))
      // Культивар у спільних лапках з назвою (поле «Культивар»): «Echeveria 'Suyon Frill Gold'» + «Frill Gold» → відбір від «Echeveria 'Suyon'»
      const cv = p.cultivarName?.trim() ?? ''
      const merged = cv ? new RegExp(`^(.+['‘’"][^'‘’"]*?)\\s+${cv.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(['‘’"])$`, 'u').exec(from0) : null
      if (merged) {
        const plain = `${merged[1]}${merged[2]}`
        add({
          productId: p.id,
          rule: 'baseFromName',
          sig: `selection|${plain}`,
          patch: { base: { origin: 'cultivar', parents: [plain], habitat: '' } },
          lines: [{ note: `baseSelection:${plain}` }],
        })
      } else if (speciesOk && q > 0) {
        const species = words.join(' ')
        add({
          productId: p.id,
          rule: 'baseFromName',
          sig: `cultivar|${species}`,
          patch: { base: { origin: 'cultivar', parents: [species], habitat: '' } },
          lines: [{ note: `baseCultivar:${species}` }],
        })
      } else if (speciesOk && q < 0) {
        // Ареал — з інших карток цього виду чи з перевірки походження, якщо є
        const key = nameKey(from0)
        const habitat =
          plants
            .flatMap((x) => [
              nameKey(withoutStates(x.name.uk)) === key && x.origin === 'natural' ? x.habitat : '',
              nameKey(x.parents?.[0] ?? '') === key && x.base?.origin === 'natural' ? x.base.habitat : '',
            ])
            .map((h) => h?.trim() ?? '')
            .find(Boolean) ||
          checks.find((r) => [r.name, r.fixedName].some((n) => n && nameKey(n) === key))?.habitat?.trim() ||
          ''
        add({
          productId: p.id,
          rule: 'baseFromName',
          sig: `natural|${from0}|${habitat}`,
          patch: { base: { origin: 'natural', parents: [], habitat: habitat ? normalizeHabitat(habitat) : '' } },
          lines: [
            { note: habitat ? `baseNatural:${from0}` : `baseNaturalNoHabitat:${from0}` },
            ...(habitat ? [{ from: '—', to: normalizeHabitat(habitat) }] : []),
          ],
        })
      }
    }

    // Походження не вказане зовсім (ні типу, ні батьків); форми — окремим правилом «Форма — мутація»
    if (!p.origin && parents.length === 0 && !parseForms(name).states.some((s) => STATE_TAGS.includes(s)) && !p.tags?.some((t) => STATE_TAGS.includes(t))) {
      // Назва в лапках одразу після роду («Echeveria 'Rezry'») — назва гібрида
      const hybridLike = /^\S+\s+['‘’"]/u.test(name.trim())
      add({
        productId: p.id,
        rule: 'originMissing',
        sig: hybridLike ? 'hybrid' : 'none',
        patch: hybridLike ? { origin: 'hybrid' } : null,
        lines: hybridLike ? [{ from: '—', to: 'hybrid' }, { note: 'originGuess' }] : [{ note: 'originNone' }],
      })
    }

    // 10. Суперечності в походженні
    if (p.origin === 'natural' && (parents.length || p.breeder?.trim())) {
      add({
        productId: p.id,
        rule: 'originConflict',
        sig: `natural|${parents.join('+')}|${p.breeder ?? ''}`,
        patch: { parents: [], breeder: '' },
        lines: [...(parents.length ? [{ from: parents.join(' × '), to: '—' }] : []), ...(p.breeder?.trim() ? [{ from: p.breeder, to: '—' }] : [])],
      })
    }
    // Підказки «гібрид без батьків» / «відбір без Від» прибрано на прохання власниці: батьки бувають невідомі

    // 11. Природний вид без ареалу — з перевірки походження чи інших карток цієї рослини, якщо там є
    if (p.origin === 'natural' && !p.habitat?.trim()) {
      const fam = familyOf(p)
      const fromCards = plants
        .flatMap((q) => [
          familyOf(q) === fam && q.origin === 'natural' ? q.habitat : '',
          familyOf(q) === fam && q.base?.origin === 'natural' ? q.base.habitat : '',
        ])
        .map((h) => h?.trim() ?? '')
        .find(Boolean)
      const fromCheck = checks.find((r) => [r.name, r.fixedName].some((n) => n && nameKey(n) === own))?.habitat?.trim()
      const found = fromCards || fromCheck
      add({
        productId: p.id,
        rule: 'habitat',
        sig: found ?? 'none',
        patch: found ? { habitat: normalizeHabitat(found) } : null,
        lines: found ? [{ from: '—', to: normalizeHabitat(found) }] : [{ note: 'noHabitat' }],
      })
    }

    // 13. Ареал однаково (і в блоці «Походження …» форми)
    const h = p.habitat?.trim()
    if (h && normalizeHabitat(h) !== h)
      add({ productId: p.id, rule: 'habitatSpelling', sig: h, patch: { habitat: normalizeHabitat(h) }, lines: [{ from: h, to: normalizeHabitat(h) }] })
    const bh = p.base?.habitat?.trim()
    if (p.base && bh && normalizeHabitat(bh) !== bh)
      add({
        productId: p.id,
        rule: 'habitatSpelling',
        sig: `base|${bh}`,
        patch: { base: { ...p.base, habitat: normalizeHabitat(bh) } },
        lines: [{ from: bh, to: normalizeHabitat(bh) }],
      })
  }

  // Селекціонер форми скопійовано зі звичайної версії — прибрати (його видно в блоці «Від …», і за ним форма знаходиться)
  const breederByKey = new Map(plants.map((p) => [nameKey(p.name.uk), p.breeder?.trim() ?? '']))
  for (const p of plants) {
    const own = p.breeder?.trim()
    const source = sourceNameOf(p)
    const theirs = source ? breederByKey.get(nameKey(source)) : undefined
    if (!own || !source) continue
    // Той самий селекціонер, навіть записаний трохи інакше («Altman Plants» і «Altman Plants (Renee O'Connell)»)
    const a = own.toLowerCase()
    const b = (theirs ?? '').toLowerCase()
    const same = !!b && (a === b || a.startsWith(b) || b.startsWith(a))
    // Форма (variegata…), а звичайної версії в магазині немає — селекціонер у формі майже напевно від звичайної версії
    const isForm = !!p.tags?.some((t) => STATE_TAGS.includes(t)) || parseForms(name0(p)).states.some((s) => STATE_TAGS.includes(s))
    if (same)
      add({
        productId: p.id,
        rule: 'breederCopied',
        sig: `${own}|${source}`,
        patch: { breeder: '' },
        lines: [{ from: own, to: '—' }, { note: `breederFrom:${source}` }],
      })
    else if (theirs === undefined && isForm)
      add({
        productId: p.id,
        rule: 'breederCopied',
        sig: `${own}|${source}|nocard`,
        patch: { breeder: '' },
        lines: [{ from: own, to: '—' }, { note: `breederNoCard:${source}` }],
      })
  }

  // 7. Та сама інша назва в різних рослинах. Одна родина — як у «Інші форми цієї рослини» (familyKey): форми, «hybrid» і культивар
  // у лапках разом (Orion, Orion hybrid, Orion variegata; chihuahuaensis і її 'Ruby Blush') — їм спільні інші назви й мають бути
  const aliasOwners = new Map<string, Product[]>()
  for (const p of plants) for (const a of uniqCI(p.aliases ?? [])) aliasOwners.set(a.toLowerCase(), [...(aliasOwners.get(a.toLowerCase()) ?? []), p])
  for (const p of plants) {
    const notes: FixLine[] = []
    for (const a of uniqCI(p.aliases ?? [])) {
      const others = (aliasOwners.get(a.toLowerCase()) ?? []).filter((q) => familyKey(q.name.uk, q.cultivarName) !== familyKey(p.name.uk, p.cultivarName))
      if (others.length) notes.push({ note: `alias:${a}:${others.map((q) => q.name.uk).join(', ')}` })
      const named = byKey.get(nameKey(a))
      if (named && familyKey(named.name.uk, named.cultivarName) !== familyKey(p.name.uk, p.cultivarName)) notes.push({ note: `aliasName:${a}` })
    }
    if (notes.length) add({ productId: p.id, rule: 'aliasShared', sig: notes.map((n) => n.note).join('|'), patch: null, lines: notes })
  }

  // 12. Селекціонер однаково: «Dick Wright» / «D. Wright» / «dick wright» — вибирає продавець (за замовчуванням — найчастіше)
  const spellings = new Map<string, Map<string, number>>()
  for (const p of plants) {
    const b = p.breeder?.trim()
    if (!b) continue
    const k = breederKey(b)
    const m = spellings.get(k) ?? new Map<string, number>()
    spellings.set(k, m.set(b, (m.get(b) ?? 0) + 1))
  }
  // Лише прізвище («Wright») — до того самого, якщо таке прізвище є лише в одного селекціонера
  for (const [k, m] of [...spellings]) {
    if (k.includes(' ')) continue
    const targets = [...spellings.keys()].filter((x) => x.startsWith(`${k} `))
    if (targets.length === 1) {
      const t = spellings.get(targets[0])!
      for (const [b, n] of m) t.set(b, (t.get(b) ?? 0) + n)
      spellings.delete(k)
    }
  }
  const keyOfSpelling = new Map<string, string>()
  for (const [k, m] of spellings) for (const b of m.keys()) keyOfSpelling.set(b, k)
  for (const p of plants) {
    const b = p.breeder?.trim()
    const k = b ? keyOfSpelling.get(b) : undefined
    const m = k ? spellings.get(k) : undefined
    if (!b || !k || !m || m.size < 2) continue
    const options = [...m].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0])).map(([s]) => s)
    const pick = choices.breeders?.get(k)
    const value = pick && options.includes(pick) ? pick : options[0]
    if (value === b) continue
    add({
      productId: p.id,
      rule: 'breederSpelling',
      sig: `${k}|${options.slice().sort().join('+')}`,
      patch: { breeder: value },
      lines: [{ from: b, to: value }],
      choice: { kind: 'breeder', key: k, options, value },
    })
  }

  // Рід в адресі сторінки інший, ніж у рослини («crassula-blue-bird-variegata» в Echeveria) — нова адреса з назви;
  // стара лишається в oldSlugs, тож старі посилання й далі відкривають рослину
  const slugs = new Set(products.flatMap((p) => [p.slug, ...(p.oldSlugs ?? [])]))
  for (const p of plants) {
    const genus = p.genus || detectGenus(p.name.uk) || ''
    const inSlug = detectGenus(p.slug.split('-')[0] ?? '')
    const genusWrong = !!genus && !!inSlug && inSlug.toLowerCase() !== genus.toLowerCase()
    // Форми (variegata / cristata / monstrose) в адресі й у назві різні — або адреса стара, або забули галочку форми
    const slugWords = p.slug.split('-')
    const nameStates = parseForms(p.name.uk).states.filter((s) => STATE_TAGS.includes(s))
    const extra = STATE_TAGS.filter((s) => slugWords.includes(s) && !nameStates.includes(s))
    const missing = nameStates.filter((s) => !slugWords.includes(s))
    const formWrong = extra.length > 0 || missing.length > 0
    if (!genusWrong && !formWrong) continue
    const base = slugify(p.name.uk)
    let next = base
    for (let i = 2; slugs.has(next) && next !== p.slug; i++) next = `${base}-${i}`
    if (!next || next === p.slug) continue
    slugs.add(next)
    add({
      productId: p.id,
      rule: genusWrong ? 'slugGenus' : 'slugForm',
      sig: next,
      patch: { slug: next, oldSlugs: [...new Set([...(p.oldSlugs ?? []), p.slug])] },
      lines: [{ from: p.slug, to: next }, ...(!genusWrong && extra.length ? [{ note: `slugExtra:${extra.join(',')}` }] : []), { note: 'oldLink' }],
    })
  }

  // 14. Порядок у магазині: товар показано й «У продажу», але без фото чи ціни.
  // (Розпродано — нормальний стан, а відсутній опис — не помилка: ці правила прибрано на прохання власниці.)
  for (const p of products) {
    if (p.isActive && p.forSale !== false) {
      const issues = [...(p.images?.length ? [] : ['noPhoto']), ...(p.price > 0 ? [] : ['noPrice'])]
      if (issues.length) add({ productId: p.id, rule: 'shopReady', sig: issues.join('|'), patch: null, lines: issues.map((note) => ({ note })) })
    }
  }
  return out
}
