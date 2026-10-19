import { nameKey, parseForms } from '../../lib/plantName'
import { STATE_TAGS, type PlantTag } from '../../lib/plants'
import { slugify } from '../../lib/slug'
import type { PlantOrigin, Product } from '../../lib/types'

/**
 * Імпорт з таблиці продавчині (Google Таблиці → «Копіювати» → вставити в адмінку).
 * Колонки: Genus, Name, Cultivar, Form, Full name, Second Name, Quantity, Parents/Native Range, Min $, Max $, Min ₴, Max ₴…
 *
 * Що робить:
 *  - товарам, які вже є в базі, оновлює лише назву — за правилами таблиці («Echeveria 'Lola' variegata»),
 *    без власних позначок продавчині в дужках («(жовта)», «(легка варієгатність)»);
 *  - рослини з таблиці, яких у базі немає, додає прихованими («немає в наявності»).
 * Фото, ціни, залишки, видимість і адреси наявних товарів не змінюються.
 */

export interface SheetPlant {
  /** Номер рядка в таблиці — щоб показати продавчині, звідки взявся товар. */
  row: number
  genus: string
  /** Назва без роду й форм, як у таблиці: «'Lola'», «agavoides 'Maria'». */
  cultivar: string
  tags: PlantTag[]
  /** Власна позначка продавчині кирилицею з «Second Name» у дужках — у назву на сайті не йде. */
  note: string
  aliases: string[]
  priceUah: number
  origin?: PlantOrigin
  parents?: string[]
  habitat?: string
  breeder?: string
}

const str = (v: unknown) => String(v ?? '').replace(/\s+/g, ' ').trim()

// Кирилиця, схожа на латиницю («Сat eye» з кириличною С) → латиниця, якщо слово латинське.
const LOOKALIKE: Record<string, string> = { С: 'C', с: 'c', А: 'A', а: 'a', Е: 'E', е: 'e', О: 'O', о: 'o', Р: 'P', р: 'p', Х: 'X', х: 'x', Т: 'T', К: 'K', М: 'M', Н: 'H', В: 'B', І: 'I', і: 'i' }
const fixLatin = (s: string) =>
  s
    .split(' ')
    .map((w) => (/[A-Za-z]/.test(w) && /[А-Яа-яІіЇїЄєҐґ]/.test(w) ? [...w].map((c) => LOOKALIKE[c] ?? c).join('') : w))
    .join(' ')

/** «E. lilacina» → «Echeveria lilacina» у колонці батьків. */
const expand = (s: string) =>
  str(s)
    .replace(/^×\s*/, '')
    .replace(/\s+×\s*(?=[A-Z])/g, ' × ')
    .replace(/^E[.,]?\s+(?=['A-Za-z])/, 'Echeveria ')
    .replace(/\.$/, '')
    .replace(/\s*\(form of [^)]*\)/i, '')
    .trim()

const COUNTRY: Record<string, string> = { MEXICO: 'Мексика' }

/** Батьки / ареал / походження з колонки «Parents/Native Range». */
function parseOrigin(raw: string, formHybrid: boolean): Pick<SheetPlant, 'origin' | 'parents' | 'habitat' | 'breeder'> {
  let s = str(raw)
  const out: Pick<SheetPlant, 'origin' | 'parents' | 'habitat' | 'breeder'> = {}
  // Селекціонер у дужках: «(Dick Wright hybrid)», «(Paco Serrano's hybrid)», «(Japanese hybrid)»
  const br = s.match(/\(([^()]*?)(?:'s)?\s+hybrid\)/i)
  if (br) {
    out.breeder = br[1].trim() === 'Japanese' ? 'Японська селекція' : br[1].trim()
    s = s.replace(br[0], '').trim()
  }
  if (!s || /^unknown/i.test(s)) return formHybrid || out.breeder ? { ...out, origin: 'hybrid' } : out
  if (COUNTRY[s]) return { origin: 'natural', habitat: COUNTRY[s] }
  if (s === 'Одеса') return { origin: 'hybrid', breeder: 'Одеса' }
  if (/\?/.test(s) || /^sister seedling of/i.test(s)) return { ...out, origin: 'hybrid' }
  let m = s.match(/^(?:somatic |chance |variegated )?(?:mutation|sport) of (.+)$/i) ?? s.match(/^cultivar of (.+)$/i)
  if (m) return { ...out, origin: 'cultivar', parents: [expand(m[1])] }
  if ((m = s.match(/^hybrid (?:of|with) (.+)$/i))) return { ...out, origin: 'hybrid', parents: [expand(m[1])] }
  // «E. purpusorum hybrid (E. 'Pumila') × E 'Afterglow'» — материнська тут сам 'Pumila'
  s = s.replace(/E\.\s*\w+ hybrid \((E\.\s*'[^']+')\)/, '$1')
  const parts = s.split(/\s+(?:×|and)\s+/)
  if (parts.length === 2) return { ...out, origin: 'hybrid', parents: parts.map(expand) }
  return out
}

/** «Second Name»: інші назви + позначка кирилицею в дужках («Queens Maria (зелена)»). */
function parseSecond(raw: string): { aliases: string[]; note: string } {
  let s = str(raw)
  if (!s || /^!!!/.test(s)) return { aliases: [], note: '' }
  const notes: string[] = []
  s = s.replace(/\(([^)]*)\)/g, (_, inner: string) => {
    if (/[А-Яа-яІіЇїЄє]/.test(inner)) {
      notes.push(inner.trim())
      return ''
    }
    return ', ' + inner // латинська назва в дужках — теж інша назва
  })
  const aliases = s
    .split(',')
    .map((a) => a.replace(/\?+/g, '').replace(/^cv\.?\s+/i, '').replace(/\s+cv$/i, '').trim())
    .filter(Boolean)
  return { aliases, note: notes.join(', ') }
}

const HEADERS = {
  genus: /^genus$/i,
  name: /^name$/i,
  cultivar: /^cultivar$/i,
  form: /^form$/i,
  second: /^second name$/i,
  parents: /^parents/i,
  maxUah: /^max ₴$/i,
} as const
// Порядок колонок у таблиці — якщо вставили без рядка заголовків.
const DEFAULT_COLUMNS = { genus: 0, name: 1, cultivar: 2, form: 3, second: 5, parents: 7, maxUah: 11 }

/** Клітинку з лапками всередині таблиця копіює як «"elegans ""Mexican Snowball"""» — повертаємо як було. */
const cells = (line: string) => line.split('\t').map((c) => (/^".*"$/s.test(c) ? c.slice(1, -1).replace(/""/g, '"') : c))

/** Текст, скопійований з таблиці (колонки через Tab), → рослини. Порожні шаблонні рядки пропускаються. */
export function parseSheet(text: string): SheetPlant[] {
  const lines = text.replace(/\r/g, '').split('\n')
  const first = lines[0] ? cells(lines[0]) : []
  const hasHeader = first.some((c) => HEADERS.genus.test(c.trim()))
  const col = { ...DEFAULT_COLUMNS }
  if (hasHeader) {
    for (const [key, re] of Object.entries(HEADERS) as [keyof typeof HEADERS, RegExp][]) {
      const i = first.findIndex((c) => re.test(c.trim()))
      if (i >= 0) col[key] = i
    }
  }
  const plants: SheetPlant[] = []
  lines.forEach((line, i) => {
    if (hasHeader && i === 0) return
    const r = cells(line)
    let genus = str(r[col.genus])
    let cultivar = fixLatin([str(r[col.name]), str(r[col.cultivar])].filter(Boolean).join(' '))
    const form = str(r[col.form])
    const priceUah = Number(str(r[col.maxUah]).replace(/[^\d.,]/g, '').replace(',', '.')) || 0
    if (!genus || (!cultivar && !priceUah)) return
    // Позначка продавчині «!!! додати Agave»: рід у таблиці тимчасово записаний як інший.
    const second = str(r[col.second])
    const move = second.match(/^!!!\s*додати\s+(\w+)/i)
    if (move) {
      genus = move[1]
      cultivar = cultivar.replace(new RegExp('^' + genus + '\\s*', 'i'), '')
    }
    const tags = STATE_TAGS.filter((t) => new RegExp('f\\.\\s*' + t, 'i').test(form))
    const { aliases, note } = parseSecond(second)
    // Інша назва, що вже є в самій назві, нічого не додає
    const plain = (s: string) => s.toLowerCase().replace(/'/g, '')
    plants.push({
      row: i + 1,
      genus,
      cultivar,
      tags,
      note,
      aliases: aliases.filter((a) => !plain(cultivar).includes(plain(a))),
      priceUah,
      ...parseOrigin(r[col.parents] ?? '', /f\.\s*hybrid/i.test(form)),
    })
  })
  return plants
}

/** Назва на сайті: «Echeveria 'Lola' variegata» — рід, назва з таблиці, форми. Без позначок у дужках. */
export function siteName(p: Pick<SheetPlant, 'genus' | 'cultivar' | 'tags'>): string {
  return [p.genus, p.cultivar, ...p.tags].filter(Boolean).join(' ')
}

/** Ключ для зіставлення: лише літери й цифри, малими — лапки, крапки, дужки й пробіли не важать. */
const key = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, '')

/** Як рослина звалася в базі після першого імпорту: з позначкою в дужках. */
const importedName = (p: SheetPlant) => [p.genus, p.cultivar, p.note && `(${p.note})`, ...p.tags].filter(Boolean).join(' ')

function distance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 3
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]
    prev[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1))
      diag = tmp
    }
  }
  return prev[b.length]
}

export interface ImportPlan {
  /** `tags` — лише якщо форма в таблиці змінилась (напр. рослину тепер записано як variegata). */
  renames: { id: string; from: string; to: string; tags?: PlantTag[] }[]
  /** Наявні товари, назва яких уже правильна. */
  unchanged: number
  creates: { id: string; rows: number[]; data: Omit<Product, 'id' | 'createdAt'> & { importedFrom: string } }[]
  /** Товари з бази, яких не знайшлося в таблиці, — їх не чіпаємо. */
  notInSheet: { id: string; name: string }[]
  /**
   * Наявні рослини, у яких у таблиці інші батьки, походження, ареал, селекціонер чи інші назви.
   * Продавчиня сама вибирає галочками, що застосувати. Порожня клітинка в таблиці нічого не стирає.
   */
  updates: ProductUpdate[]
}

export type UpdateField = 'parents' | 'origin' | 'habitat' | 'breeder' | 'aliases'
export interface ProductUpdate {
  id: string
  name: string
  changes: { field: UpdateField; from: string; to: string }[]
  /** Що записати в товар, якщо зміну вибрано */
  patch: Partial<Pick<Product, 'parents' | 'origin' | 'habitat' | 'breeder' | 'aliases'>>
}

/** Що в таблиці не так, як на сайті (для наявної рослини). */
function diffWithSheet(p: ImportProduct, plant: SheetPlant): ProductUpdate | null {
  const changes: ProductUpdate['changes'] = []
  const patch: ProductUpdate['patch'] = {}
  const list = (xs?: string[]) => (xs ?? []).filter(Boolean)
  // Варієгату / кристату вже зробили «мутацією від» звичайної версії («Виправити форми») — не повертаємо їй батьків гібрида
  const fixedForm = p.origin === 'cultivar' && (p.tags ?? []).some((t) => STATE_TAGS.includes(t))
  if (!fixedForm) {
    if (plant.origin && plant.origin !== (p.origin ?? (list(p.parents).length ? 'hybrid' : undefined))) {
      changes.push({ field: 'origin', from: p.origin ?? '', to: plant.origin })
      patch.origin = plant.origin
    }
    const sheetParents = list(plant.parents)
    if (sheetParents.length && sheetParents.map(nameKey).join('|') !== list(p.parents).map(nameKey).join('|')) {
      changes.push({ field: 'parents', from: list(p.parents).join(' × '), to: sheetParents.join(' × ') })
      patch.parents = sheetParents
    }
  }
  if (plant.habitat && plant.habitat !== (p.habitat ?? '')) {
    changes.push({ field: 'habitat', from: p.habitat ?? '', to: plant.habitat })
    patch.habitat = plant.habitat
  }
  if (plant.breeder && plant.breeder !== (p.breeder ?? '')) {
    changes.push({ field: 'breeder', from: p.breeder ?? '', to: plant.breeder })
    patch.breeder = plant.breeder
  }
  // Інші назви — лише додаємо нові, наявні не прибираємо
  const have = new Set(list(p.aliases).map((a) => a.toLowerCase()))
  const extra = plant.aliases.filter((a) => a && !have.has(a.toLowerCase()))
  if (extra.length) {
    changes.push({ field: 'aliases', from: list(p.aliases).join(', '), to: [...list(p.aliases), ...extra].join(', ') })
    patch.aliases = [...list(p.aliases), ...extra]
  }
  return changes.length ? { id: p.id, name: p.name.uk, changes, patch } : null
}

type ImportProduct = Pick<Product, 'id' | 'slug' | 'name' | 'category' | 'tags' | 'origin' | 'parents' | 'habitat' | 'breeder' | 'aliases'>

export function planImport(plants: SheetPlant[], products: ImportProduct[], today: string): ImportPlan {
  const plantsDb = products.filter((p) => p.category === 'plants')
  const byKey = new Map<string, typeof plantsDb>()
  for (const p of plantsDb) byKey.set(key(p.name.uk), [...(byKey.get(key(p.name.uk)) ?? []), p])

  const matched = new Map<string, SheetPlant>() // id товару → рядок таблиці
  const unmatched: SheetPlant[] = []
  for (const plant of plants) {
    // Спершу — назва з позначкою (як після першого імпорту), потім — нова назва без неї.
    const found = byKey.get(key(importedName(plant))) ?? byKey.get(key(siteName(plant)))
    if (found) found.forEach((p) => matched.set(p.id, plant))
    else unmatched.push(plant)
  }
  const leftover = () => plantsDb.filter((p) => !matched.has(p.id))
  const states = (tags: PlantTag[] | undefined) => (tags ?? []).filter((t) => STATE_TAGS.includes(t)).sort().join()
  // Друкарські відмінності («Buritto» → «Burrito», «zaragoza» → «zaragozae»): одна найближча назва з тими самими формами.
  const notTypo: SheetPlant[] = []
  for (const plant of unmatched) {
    const k = key(importedName(plant))
    const near = leftover().filter((p) => k.length > 8 && distance(k, key(p.name.uk)) <= 2 && states(p.tags) === states(plant.tags))
    if (near.length === 1) matched.set(near[0].id, plant)
    else notTypo.push(plant)
  }
  // Продавчиня змінила в таблиці форму чи позначку («Flamenco» → «Flamenco variegata», «(жовта)» → «(рожева)»):
  // та сама рослина за назвою без форм і позначок — якщо в базі лишився рівно один такий товар.
  const baseKey = (name: string) => key(parseForms(name.replace(/\([^)]*[А-Яа-яІіЇїЄє][^)]*\)/g, ' ')).base)
  const stillNew: SheetPlant[] = []
  for (const plant of notTypo) {
    const k = key([plant.genus, plant.cultivar].join(' '))
    const same = leftover().filter((p) => baseKey(p.name.uk) === k)
    if (same.length === 1) matched.set(same[0].id, plant)
    else stillNew.push(plant)
  }

  const renames: ImportPlan['renames'] = []
  const updates: ProductUpdate[] = []
  let unchanged = 0
  for (const p of plantsDb) {
    const plant = matched.get(p.id)
    if (!plant) continue
    const update = diffWithSheet(p, plant)
    if (update) updates.push(update)
    const to = siteName(plant)
    const tagsChanged = states(p.tags) !== states(plant.tags)
    if (to === p.name.uk && !tagsChanged) unchanged++
    else
      renames.push({
        id: p.id,
        from: p.name.uk,
        to,
        // Решту тегів (напр. «живець») лишаємо, міняємо лише форми.
        ...(tagsChanged ? { tags: [...(p.tags ?? []).filter((t) => !STATE_TAGS.includes(t)), ...plant.tags] } : {}),
      })
  }

  // Рядок, що відрізняється від наявного товару лише позначкою («Pink Champagne (зелена)»), — той самий товар на сайті.
  const existingNames = new Set([...matched.values()].map((p) => key(siteName(p))))
  // Однакові рядки (той самий товар кількома рядками) — один новий товар.
  const groups = new Map<string, SheetPlant[]>()
  for (const p of stillNew) {
    const k = key(siteName(p))
    if (!existingNames.has(k)) groups.set(k, [...(groups.get(k) ?? []), p])
  }
  const usedIds = new Set(products.flatMap((p) => [p.id, p.slug]))
  const creates: ImportPlan['creates'] = []
  for (const group of groups.values()) {
    const p = group[0]
    const name = siteName(p)
    const base = slugify(name)
    let id = base
    for (let n = 2; usedIds.has(id); n++) id = `${base}-${n}`
    usedIds.add(id)
    const aliases = [...new Set(group.flatMap((g) => g.aliases))]
    creates.push({
      id,
      rows: group.map((g) => g.row),
      data: {
        category: 'plants',
        slug: id,
        name: { uk: name },
        description: { uk: '' },
        price: Math.round(Math.max(...group.map((g) => g.priceUah)) * 100),
        // Нові рослини з таблиці — поки «немає в наявності»: приховані й без залишку.
        stock: 0,
        isActive: false,
        images: [],
        genus: p.genus,
        tags: p.tags,
        specs: [],
        ...(aliases.length ? { aliases } : {}),
        ...(p.origin ? { origin: p.origin } : {}),
        ...(p.parents ? { parents: p.parents } : {}),
        ...(p.habitat ? { habitat: p.habitat } : {}),
        ...(p.breeder ? { breeder: p.breeder } : {}),
        importedFrom: `sheet-${today}`,
      },
    })
  }

  return {
    renames,
    unchanged,
    creates,
    notInSheet: plantsDb.filter((p) => !matched.has(p.id)).map((p) => ({ id: p.id, name: p.name.uk })),
    updates: updates.sort((a, b) => a.name.localeCompare(b.name)),
  }
}
