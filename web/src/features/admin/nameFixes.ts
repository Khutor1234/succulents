import { editDistance, nameKey, parseForms, withoutStates } from '../../lib/plantName'
import { PLANT_CATEGORY, STATE_TAGS } from '../../lib/plants'
import type { PlantOrigin, Product } from '../../lib/types'
import type { CheckRow } from './originCheck'

/**
 * «Виправити назви»: батьки, записані не так, як рослина в магазині, — інші лапки чи регістр («graptoveria Debbie»)
 * або описка в кілька букв («Debbi»). Через описку батько й нащадки не пов'язуються між собою (сторінка товару,
 * «Пов'язані рослини», аналітика). Тут такі назви стають точно такими, як у магазині.
 * Якщо самої рослини в магазині немає, а серед батьків вона записана по-різному («Echeveria moon» і «Echeveria Moon»),
 * правильне написання вибирає продавець (за замовчуванням — найчастіше).
 *
 * Друге правило — «Походження з інших записів»: батьки однієї рослини можуть бути записані в кількох місцях —
 * у її картці, у блоці «Походження …» карток її форм (variegata, cristata, monstrose), у старому походженні форми
 * (ще не виправленої у «Формах») і в збереженій «Перевірці походження». Якщо десь порожньо, а в іншому місці відомо, —
 * пропонуємо дописати; якщо записи різні — показуємо «Було / Стане», а правильний варіант вибирає продавець
 * (за замовчуванням — як у картці самої рослини).
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

export interface Lineage {
  origin: PlantOrigin
  parents: string[]
  habitat?: string
}

/** Звідки відомо походження: картка рослини, «Походження …» у формі, старе походження форми, перевірка походження */
export interface LineageSource {
  kind: 'card' | 'base' | 'formOld' | 'check'
  name: string
}

export interface LineageVariant {
  sig: string
  lineage: Lineage
  sources: LineageSource[]
}

export interface LineageChange {
  /** Рослина, про чиє походження йдеться (звичайна версія, без форм) */
  plant: string
  /** Ключ рослини — для вибору правильного варіанта */
  key: string
  /** Що міняємо: походження самої картки чи блок «Походження …» у формі */
  target: 'card' | 'base'
  from: Lineage | null
  to: Lineage
  /** Вибраний варіант */
  sig: string
  /** Усі відомі варіанти, якщо вони різні (вибирає продавець) */
  variants?: LineageVariant[]
  /** Звідки взято нове */
  sources: LineageSource[]
}

export interface NameFix {
  id: string
  /** Мале фото рослини в списку правок */
  image?: string
  slug: string
  name: string
  changes: NameChange[]
  /** Нові батьки рослини */
  parents: string[]
  /** Нове «Походження звичайної версії» (для форм), якщо там теж були назви до виправлення */
  base?: Product['base']
  /** Походження з інших записів — окрема пропозиція (картка рослини чи блок «Походження …» у формі) */
  lineage?: LineageChange
}

type Plant = Pick<Product, 'id' | 'slug' | 'name' | 'category' | 'parents' | 'base' | 'origin' | 'habitat' | 'tags'> & { images?: string[] }

/**
 * `chosen` — вибране продавцем правильне написання для рослин, яких немає в магазині (ключ — nameKey);
 * `checks` — збережені перевірки походження;
 * `lineageChosen` — вибраний варіант походження рослини (ключ — nameKey рослини, значення — sig варіанта).
 */
export function planNameFixes(
  products: Plant[],
  chosen: ReadonlyMap<string, string> = new Map(),
  checks: readonly CheckRow[] = [],
  lineageChosen: ReadonlyMap<string, string> = new Map(),
): NameFix[] {
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

  const lineageFixes = planLineage(plants, checks, lineageChosen)
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
    const lineage = lineageFixes.get(p.id)
    // Нове походження теж записуємо з правильними назвами батьків (без окремих рядків «описка» — це вже нові батьки)
    const to = lineage && { ...lineage.to, parents: lineage.to.parents.map((n) => targetOf(nameKey(n))?.to ?? n) }
    // Назви батьків і походження — окремі пропозиції (кожну можна прийняти окремо), тож рахуємо їх незалежно
    const parents = fixList(p.parents)
    const baseParents = p.base ? fixList(p.base.parents) : undefined
    if (changes.length === 0 && !lineage) continue
    fixes.push({
      id: p.id,
      slug: p.slug,
      name: p.name.uk,
      image: p.images?.[0],
      changes,
      parents,
      ...(p.base && baseParents ? { base: { ...p.base, parents: baseParents } } : {}),
      ...(lineage && to ? { lineage: { ...lineage, to } } : {}),
    })
  }
  return fixes.sort((a, b) => a.name.localeCompare(b.name))
}

const hasForms = (p: Plant) => !!p.tags?.some((t) => STATE_TAGS.includes(t)) || parseForms(p.name.uk).states.length > 0
const cleanList = (list: readonly string[] = []) => list.map((x) => x.trim()).filter(Boolean)
/** Однакове походження — той самий тип і ті самі батьки (у будь-якому порядку й написанні) */
const sigOf = (l: Lineage) => `${l.origin}|${l.origin === 'natural' ? '' : l.parents.map(nameKey).sort().join('+')}`
/** Чи взагалі щось відомо: природний вид або хоча б один батько */
const known = (l: Lineage | null | undefined): l is Lineage => !!l && (l.origin === 'natural' || l.parents.length > 0)
function lineageOf(origin: PlantOrigin | null | undefined, parents: readonly string[] | undefined, habitat?: string): Lineage | null {
  if (!origin) return null
  if (origin === 'natural') return { origin, parents: [], habitat: habitat?.trim() ?? '' }
  return { origin, parents: cleanList(parents).slice(0, origin === 'cultivar' ? 1 : 2) }
}

/**
 * Походження кожної рослини з усіх місць, де воно записане, — і що де дописати чи виправити.
 * Результат: id товару → зміна (картка самої рослини або блок «Походження …» у формі).
 */
function planLineage(plants: Plant[], checks: readonly CheckRow[], chosen: ReadonlyMap<string, string>): Map<string, LineageChange> {
  // Рослина (звичайна версія) → її картка й форми
  const groups = new Map<string, { plant: string; card?: Plant; forms: Plant[] }>()
  for (const p of plants) {
    const plain = withoutStates(p.name.uk)
    const key = nameKey(plain)
    if (!key) continue
    const g = groups.get(key) ?? { plant: plain, forms: [] as Plant[] }
    if (hasForms(p)) g.forms.push(p)
    else if (!g.card) {
      g.card = p
      g.plant = p.name.uk.trim()
    }
    groups.set(key, g)
  }
  const checkByKey = new Map<string, CheckRow>()
  for (const r of checks) for (const n of [r.name, r.fixedName]) if (n?.trim()) checkByKey.set(nameKey(n), r)

  const out = new Map<string, LineageChange>()
  for (const [key, g] of groups) {
    const records: { lineage: Lineage; source: LineageSource }[] = []
    const cardLineage = g.card ? lineageOf(g.card.origin, g.card.parents, g.card.habitat) : null
    if (g.card && known(cardLineage)) records.push({ lineage: cardLineage, source: { kind: 'card', name: g.card.name.uk } })
    for (const f of g.forms) {
      const b = f.base ? lineageOf(f.base.origin, f.base.parents, f.base.habitat) : null
      if (known(b)) records.push({ lineage: b, source: { kind: 'base', name: f.name.uk } })
      // Форма ще з батьками самої рослини (не виправлена у «Формах»): «Debbie monstrose» — lilacina × amethystinum
      else if (f.origin === 'hybrid') {
        const old = lineageOf('hybrid', f.parents)
        if (known(old) && !old.parents.some((x) => nameKey(x) === key)) records.push({ lineage: old, source: { kind: 'formOld', name: f.name.uk } })
      }
    }
    const row = checkByKey.get(key)
    const fromCheck = row ? lineageOf(row.origin, row.parents, row.habitat) : null
    if (row && known(fromCheck)) records.push({ lineage: fromCheck, source: { kind: 'check', name: row.fixedName || row.name } })
    if (records.length === 0) continue

    const variants: LineageVariant[] = []
    for (const r of records) {
      const sig = sigOf(r.lineage)
      const v = variants.find((x) => x.sig === sig)
      if (v) {
        v.sources.push(r.source)
        // Ареал — з першого запису, де він є
        if (!v.lineage.habitat && r.lineage.habitat) v.lineage = { ...v.lineage, habitat: r.lineage.habitat }
      } else variants.push({ sig, lineage: r.lineage, sources: [r.source] })
    }
    // За замовчуванням — як у картці самої рослини; немає — найчастіший варіант (перевірка походження — при рівності)
    const rank = (v: LineageVariant) =>
      v.sources.length + (v.sources.some((x) => x.kind === 'check') ? 0.5 : 0) + (v.sources.some((x) => x.kind === 'card') ? 100 : 0)
    variants.sort((a, b) => rank(b) - rank(a))
    const target = variants.find((v) => v.sig === chosen.get(key)) ?? variants[0]
    const change = (t: 'card' | 'base', from: Lineage | null): LineageChange => ({
      plant: g.plant,
      key,
      target: t,
      from,
      to: target.lineage,
      sig: target.sig,
      ...(variants.length > 1 ? { variants } : {}),
      sources: target.sources,
    })

    // Картка самої рослини: порожньо або інакше, ніж вибраний варіант
    if (g.card && (!known(cardLineage) || sigOf(cardLineage) !== target.sig)) out.set(g.card.id, change('card', known(cardLineage) ? cardLineage : null))
    for (const f of g.forms) {
      const b = f.base ? lineageOf(f.base.origin, f.base.parents, f.base.habitat) : null
      if (known(b)) {
        if (sigOf(b) !== target.sig) out.set(f.id, change('base', b))
      } else if (!g.card) {
        // Звичайної версії в магазині немає — «Походження …» у формі єдине місце, де його видно на сайті
        out.set(f.id, change('base', null))
      }
    }
  }
  return out
}
