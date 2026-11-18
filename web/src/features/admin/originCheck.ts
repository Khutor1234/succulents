import { detectGenus, nameKey } from '../../lib/plantName'
import { PLANT_CATEGORY, STATE_TAGS } from '../../lib/plants'
import type { PlantOrigin, Product } from '../../lib/types'
import { splitAliases } from './productSchema'

/**
 * «Перевірка походження» (вкладка /admin/forms?tab=origins): звіряє рослини з тим, що знайдено на довідкових сайтах (worldofsucculents.com тощо):
 * назву (лапки, великі й малі букви, описки), походження (природний вид / гібрид / відбір), батьків, ареал, селекціонера.
 * Список рослин копіюється таблицею (TSV), Claude перевіряє й повертає таку саму таблицю з джерелом — її вставляють
 * на сторінку, і видно лише розбіжності «Було / Стане». Форми (variegata…) й «Hybrid» не перевіряються — для них «Виправити форми».
 * Рядки про рослини, яких у магазині немає (зазвичай батьки), показуються окремо з тим, що про них відомо, і плюсиком «Створити».
 */

export const COLUMNS = ['Назва', 'Правильна назва', 'Походження', 'Батько 1', 'Батько 2', 'Ареал', 'Селекціонер', 'Інші назви', 'Джерело', 'Примітка'] as const

const ORIGIN_WORDS: Record<PlantOrigin, string> = { natural: 'природний вид', hybrid: 'гібрид', cultivar: 'відбір або мутація' }

/** Рослини, чиє походження варто перевіряти: без форм і без «Hybrid» (у них походження — від звичайної версії). */
export function checkablePlants(products: Product[]): Product[] {
  return products
    .filter((p) => p.category === PLANT_CATEGORY && !p.tags?.some((t) => STATE_TAGS.includes(t) || t === 'hybridName'))
    .sort((a, b) => a.name.uk.localeCompare(b.name.uk))
}

const clean = (s?: string) => (s ?? '').replace(/[\t\r\n]+/g, ' ').trim()

/** Таблиця для перевірки: що зараз записано в кожної рослини («Правильна назва» порожня — її заповнює перевірка). */
export function toTsv(plants: Product[]): string {
  const rows = plants.map((p) => {
    const origin = p.origin ?? 'hybrid'
    const parents = origin === 'natural' ? [] : (p.parents ?? []).filter(Boolean)
    const fields = [p.name.uk, '', p.origin ? ORIGIN_WORDS[origin] : '', parents[0] ?? '', parents[1] ?? '', origin === 'natural' ? (p.habitat ?? '') : '']
    return [...fields, p.breeder ?? '', (p.aliases ?? []).join(', ')]
      .map(clean)
      .join('\t')
      .replace(/\t+$/, '')
  })
  return [COLUMNS.slice(0, 8).join('\t'), ...rows].join('\n')
}

function parseOrigin(text: string): PlantOrigin | null | undefined {
  const s = text.trim().toLowerCase()
  if (!s) return undefined
  if (s.includes('природ') || s.includes('natural') || s.includes('species')) return 'natural'
  if (s.includes('відбір') || s.includes('мутац') || s.includes('cultivar') || s.includes('sport')) return 'cultivar'
  if (s.includes('гібрид') || s.includes('hybrid')) return 'hybrid'
  // «не знайдено», «?» — про рослину нічого не відомо
  return null
}

export interface CheckRow {
  name: string
  /** Як правильно записати назву (порожньо — і так правильно) */
  fixedName: string
  /** null — не знайдено інформації; undefined — колонка порожня */
  origin: PlantOrigin | null | undefined
  parents: string[]
  habitat: string
  breeder: string
  /** Інші назви, під якими рослину знають (синоніми, торгові назви) */
  aliases: string[]
  source: string
  note: string
}

/** Читає вставлену таблицю (з табуляцією, як копіюється з Google-таблиці чи чату) у клітинки. Рядок із заголовками пропускає. */
export function parseCells(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .map((line) => line.split('\t').map((c) => c.trim().replace(/\s+/g, ' ')))
    .filter((cells) => cells[0] && cells[0].toLowerCase() !== 'назва')
    .map((cells) => cells.slice(0, COLUMNS.length))
}

/** Рядок перевірки з клітинок таблиці (так він і зберігається в базі — originChecks). */
export function rowFromCells([name, fixedName = '', origin = '', p1 = '', p2 = '', habitat = '', breeder = '', aliases = '', source = '', note = '']: string[]): CheckRow {
  return {
    name,
    fixedName,
    origin: parseOrigin(origin),
    parents: [p1, p2].filter(Boolean),
    habitat,
    breeder,
    aliases: splitAliases(aliases),
    source,
    note,
  }
}

export const parseCheck = (text: string): CheckRow[] => parseCells(text).map(rowFromCells)

export interface FieldChange {
  field: 'name' | 'origin' | 'parents' | 'habitat' | 'breeder' | 'aliases'
  from: string
  to: string
}

export interface OriginFix {
  id: string
  slug: string
  name: string
  changes: FieldChange[]
  /** Що записати в товар (шляхи Firestore: 'name.uk' — лише українська назва) */
  patch: Record<string, unknown>
  source: string
  note: string
}

export interface OriginPlan {
  fixes: OriginFix[]
  /** Усе збігається */
  ok: number
  /** Нічого не знайдено — з приміткою */
  unknown: CheckRow[]
  /** Таких рослин у магазині немає: зазвичай батьки — з тим, що про них відомо */
  missing: CheckRow[]
  /** Рослини магазину, про які вже є перевірка (id) — їх не треба копіювати на перевірку знову */
  checked: Set<string>
}

const sameText = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/** Назва виправлена: нова назва, рід (якщо змінився) і культивар у лапках для поля «Культивар» форми. */
function renamePatch(p: Product, name: string): Record<string, unknown> {
  const patch: Record<string, unknown> = { 'name.uk': name }
  const genus = detectGenus(name) ?? name.split(' ')[0]
  if (genus && genus !== p.genus) patch.genus = genus
  if (p.cultivarName) patch.cultivarName = name.match(/\S\s+['‘’"]((?:(?!['‘’"]\s).)+)['‘’"]$/u)?.[1] ?? ''
  return patch
}

/**
 * Розбіжності між записаним у магазині і знайденим. Порожні клітинки нічого не стирають (просто невідомо);
 * природний вид — без батьків, гібрид і відбір — без ареалу (так само зберігає форма товару).
 */
export function planOriginFixes(products: Product[], rows: CheckRow[]): OriginPlan {
  const plants = checkablePlants(products)
  const byKey = new Map(plants.map((p) => [nameKey(p.name.uk), p]))
  // Рослину в магазині могли записати під іншою назвою — тоді знаходимо її за «Іншими назвами» (в обидва боки)
  const byAlias = new Map<string, Product>()
  for (const p of plants) for (const a of p.aliases ?? []) if (!byKey.has(nameKey(a))) byAlias.set(nameKey(a), p)
  const find = (names: string[]) => {
    const keys = names.filter(Boolean).map(nameKey)
    return keys.map((k) => byKey.get(k)).find(Boolean) ?? keys.map((k) => byAlias.get(k)).find(Boolean)
  }
  const plan: OriginPlan = { fixes: [], ok: 0, unknown: [], missing: [], checked: new Set() }
  const seen = new Set<string>()
  for (const row of rows) {
    const p = find([row.name, row.fixedName, ...row.aliases])
    if (!p) {
      plan.missing.push(row)
      continue
    }
    if (seen.has(p.id)) continue
    seen.add(p.id)
    plan.checked.add(p.id)
    const fix = (changes: FieldChange[], patch: Record<string, unknown>) =>
      plan.fixes.push({ id: p.id, slug: p.slug, name: p.name.uk, changes, patch, source: row.source, note: row.note })

    // Назва записана неправильно (лапки, регістр, описка) — виправляємо, навіть якщо про походження нічого не знайдено
    const rename = row.fixedName && row.fixedName !== p.name.uk.trim() ? row.fixedName : ''
    const changes: FieldChange[] = rename ? [{ field: 'name', from: p.name.uk, to: rename }] : []
    const named: Record<string, unknown> = rename ? renamePatch(p, rename) : {}
    // Інші назви — лише додаємо нові (вже записані, напр. українські, не прибираємо); назва самої рослини — не «інша»
    const was = p.aliases ?? []
    const own = new Set([nameKey(p.name.uk), nameKey(rename || p.name.uk), ...was.map(nameKey)])
    const added = row.aliases.filter((a) => !own.has(nameKey(a)) && own.add(nameKey(a)))
    if (added.length) {
      changes.push({ field: 'aliases', from: was.join(', '), to: [...was, ...added].join(', ') })
      named.aliases = [...was, ...added]
    }
    if (row.origin === null || (row.origin === undefined && row.parents.length === 0 && !row.habitat && !row.breeder)) {
      if (changes.length) fix(changes, named)
      else plan.unknown.push(row)
      continue
    }

    const wasOrigin = p.origin ?? 'hybrid'
    const origin = row.origin ?? wasOrigin
    const wasParents = wasOrigin === 'natural' ? [] : (p.parents ?? []).filter(Boolean)
    const parents = origin === 'natural' ? [] : row.parents.length ? (origin === 'cultivar' ? row.parents.slice(0, 1) : row.parents) : wasParents
    const wasHabitat = wasOrigin === 'natural' ? (p.habitat ?? '') : ''
    const habitat = origin === 'natural' ? row.habitat || wasHabitat : ''
    const wasBreeder = p.breeder ?? ''
    const breeder = origin === 'natural' ? '' : row.breeder || wasBreeder

    // Не вказано — на сайті це й так «Гібрид», тож «не вказано → гібрид» без інших змін не показуємо
    if (origin !== wasOrigin) changes.push({ field: 'origin', from: p.origin ? ORIGIN_WORDS[p.origin] : '', to: ORIGIN_WORDS[origin] })
    // Батьки — і інші, і ті самі, але записані інакше (лапки, великі букви)
    if (parents.join('|') !== wasParents.join('|')) changes.push({ field: 'parents', from: wasParents.join(' × '), to: parents.join(' × ') })
    if (!sameText(habitat, wasHabitat)) changes.push({ field: 'habitat', from: wasHabitat, to: habitat })
    if (!sameText(breeder, wasBreeder)) changes.push({ field: 'breeder', from: wasBreeder, to: breeder })
    if (changes.length === 0) {
      plan.ok++
      continue
    }
    // Записуємо все походження разом — так само, як зберігає форма товару
    fix(changes, { origin, parents, habitat, breeder, ...named })
  }
  return plan
}
