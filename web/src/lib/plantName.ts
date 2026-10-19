import { GENERA, STATE_TAGS, type PlantTag } from './plants'

/**
 * Назва рослини будується як у таблиці продавця:
 *   «Echeveria 'Lola' variegata» = <вид> <сорт/назва> <форми>.
 * Форми пишуться латиною/англійською в кінці: variegata, cristata, monstrose.
 */

/**
 * Як форма пишеться в назві — просто слово, без «f.» (так попросила продавчиня).
 * Порядок — як у PLANT_TAGS (спершу варієгатна). «f. variegata» з таблиці теж розпізнається.
 */
const FORM_LABELS: Partial<Record<PlantTag, string>> = {
  variegata: 'variegata',
  cristata: 'cristata',
  monstrose: 'monstrose',
}

/** Слова, за якими впізнаємо форму в кінці назви (англійською й латиною, у різних варіантах написання). */
const FORM_PATTERNS: [PlantTag, RegExp][] = [
  // «var.» не беремо: у ботаніці це «різновид» (variety), а не варієгатність.
  ['variegata', /^variegat(a|ed|e)?$/i],
  ['cristata', /^(cristat(a|ed|e)?|crest(ed)?)$/i],
  ['monstrose', /^(monstros(a|e|us)?|monstr\.?)$/i],
]

/**
 * Українські назви родів — за основою слова, щоб упізнати будь-яку форму:
 * «Літопси», «Ехеверія», «ехеверії», «Хавортію»… Довші основи стоять раніше за коротші,
 * щоб «седевері…» не сплутати з «седум».
 */
const GENUS_STEMS: [string, (typeof GENERA)[number]][] = [
  ['корпускуляр', 'Corpuscularia'],
  ['граптопетал', 'Graptopetalum'],
  ['граптовер', 'Graptoveria'],
  ['пахіфіт', 'Pachyphytum'],
  ['пахифит', 'Pachyphytum'],
  ['пахіседум', 'Pachysedum'],
  ['пахиседум', 'Pachysedum'],
  ['пахівер', 'Pachyveria'],
  ['пахивер', 'Pachyveria'],
  ['седевер', 'Sedeveria'],
  ['котиледон', 'Cotyledon'],
  ['крестовник', 'Senecio'],
  ['ехевер', 'Echeveria'],
  ['ешевер', 'Echeveria'],
  ['крассул', 'Crassula'],
  ['красул', 'Crassula'],
  ['гринов', 'Greenovia'],
  ['гренов', 'Greenovia'],
  ['хаворт', 'Haworthia'],
  ['каланхое', 'Kalanchoe'],
  ['літопс', 'Lithops'],
  ['литопс', 'Lithops'],
  ['сенец', 'Senecio'],
  ['еоні', 'Aeonium'],
  ['эони', 'Aeonium'],
  ['седум', 'Sedum'],
  ['агав', 'Agave'],
  ['дудлей', 'Dudleya'],
]

/** Рід за першим словом назви — латиною («Echeveria») чи українською в будь-якій формі («Ехеверії»). */
function genusOfWord(word: string): (typeof GENERA)[number] | undefined {
  const w = word.toLowerCase().replace(/[«»"'.,]/g, '')
  return GENERA.find((g) => g.toLowerCase() === w) ?? GENUS_STEMS.find(([stem]) => w.startsWith(stem))?.[1]
}

function isGenusWord(word: string): boolean {
  return genusOfWord(word) !== undefined
}

/** «ехеверія Lola» + Echeveria → «Echeveria Lola». Якщо роду в назві не було — додаємо його на початок. */
export function applyGenus(name: string, genus: string): string {
  const trimmed = name.trim()
  if (!genus) return trimmed
  const [first, ...rest] = trimmed.split(/\s+/)
  if (!first) return genus
  if (isGenusWord(first)) return [genus, ...rest].join(' ')
  return `${genus} ${trimmed}`
}

/** Рід, якщо назва починається з нього (латиною чи українською). */
export function detectGenus(name: string): string | undefined {
  const first = name.trim().split(/\s+/)[0]
  return first ? genusOfWord(first) : undefined
}

/**
 * Відокремлює форми в кінці назви: «Echeveria Lola variegated, cristata» →
 * { base: 'Echeveria Lola', states: ['variegata', 'cristata'] }.
 */
export function parseForms(name: string): { base: string; states: PlantTag[] } {
  const words = name.trim().split(/\s+/)
  const found = new Set<PlantTag>()
  // Ідемо з кінця: форми й службові слова між ними («f.», «,», «and», «та»).
  // `cut` зсуваємо лише на знайдених формах — тож звичайне «та» в кінці назви без форм не зникне.
  let i = words.length
  let cut = words.length
  while (i > 0) {
    const word = words[i - 1].replace(/[,;]+$/, '')
    if (word === '' || /^(f\.?|forma|and|і|та)$/i.test(word)) {
      i--
      continue
    }
    const match = FORM_PATTERNS.find(([, re]) => re.test(word))
    if (!match) break
    found.add(match[0])
    i--
    cut = i
  }
  // «f.» перед першою формою теж належить до форм.
  while (cut > 0 && /^(f\.?|forma),?$/i.test(words[cut - 1])) cut--
  return { base: words.slice(0, cut).join(' ').replace(/[,\s]+$/, ''), states: STATE_TAGS.filter((t) => found.has(t)) }
}

/** Склеює назву з формами: ('Echeveria Lola', ['variegata', 'cristata']) → «Echeveria Lola variegata cristata». */
export function withForms(base: string, tags: PlantTag[]): string {
  const forms = STATE_TAGS.filter((t) => tags.includes(t)).map((t) => FORM_LABELS[t])
  return forms.length ? `${base.trim()} ${forms.join(' ')}` : base.trim()
}

/**
 * Ключ для порівняння назв рослин між собою (батьки ↔ товари): без регістру й лапок,
 * «×Graptoveria» = «Graptoveria», а форми в будь-якому написанні зводяться до одного
 * («variegated», «Variegata» → variegata). Тож «Graptoveria 'Debbie'» і «graptoveria Debbie» — одна рослина.
 */
export function nameKey(name: string): string {
  const words = name
    .toLowerCase()
    .replace(/['‘’"«»`ʼ]/g, ' ')
    .replace(/×/g, ' x ')
    .split(/\s+/)
    .filter(Boolean)
  // Позначка міжродового гібрида перед родом («x Graptoveria») — не частина назви
  if (words[0] === 'x') words.shift()
  return words
    .filter((w) => !/^(f\.?|forma)$/.test(w))
    .map((w) => FORM_PATTERNS.find(([, re]) => re.test(w.replace(/[,;]+$/, '')))?.[0] ?? w)
    .join(' ')
}

/** Ключ без форм: «Echeveria 'Lola' variegata» і «Echeveria Lola» — та сама рослина в різних формах. */
export function baseKey(name: string): string {
  const forms = new Set<string>(STATE_TAGS)
  return nameKey(name)
    .split(' ')
    .filter((w) => !forms.has(w))
    .join(' ')
}

/** Відстань між двома рядками в буквах (скільки букв замінити, додати чи прибрати) — щоб знаходити описки. */
export function editDistance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 3) return 99
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    prev = cur
  }
  return prev[b.length]
}

/**
 * Батька записали з опискою («Graptoveria 'Debbi'», а рослина — «Graptoveria 'Debbie'»)? Якщо точної назви серед товарів
 * немає, беремо товар того самого роду, що відрізняється щонайбільше на 2 букви. Інакше лишаємо як записано.
 */
export function makeNameResolver(keys: string[]) {
  const known = new Set(keys)
  const cache = new Map<string, string>()
  return (name: string) => {
    const key = nameKey(name)
    if (known.has(key)) return key
    const hit = cache.get(key)
    if (hit !== undefined) return hit
    const genus = key.split(' ')[0]
    let best = key
    let bestDist = 3
    for (const k of keys) {
      if (k.split(' ')[0] !== genus || k.length < 6) continue
      const dist = editDistance(key, k)
      if (dist < bestDist) {
        best = k
        bestDist = dist
      }
    }
    cache.set(key, best)
    return best
  }
}
