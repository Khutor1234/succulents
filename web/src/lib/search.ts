import { detectGenus } from './plantName'
import type { Product } from './types'

/**
 * Пошук товарів прямо в браузері (каталог невеликий — сотні позицій, тож окремий пошуковий сервіс не потрібен).
 *
 * Розуміє:
 * - латинські назви й сорти: «lola», «echeveria lola»;
 * - українські назви родів у будь-якій формі: «ехеверія», «літопси», «хавортію» → Echeveria, Lithops, Haworthia;
 * - кирилицю, набрану замість латиниці: «лола» → lola, «ромео» → romeo;
 * - особливості й категорії: «variegata», «вариегата», «живець» (і розмовне «зріз»), «б/у», «горщик».
 * Кожне слово запиту має десь знайтися; порядок слів не важливий.
 */

/** Як ще шукають особливість: продавці й покупці часто кажуть «зріз» замість «живець». */
const TAG_SYNONYMS: Record<string, string[]> = { cutting: ['зріз', 'живці'], used: ['бу', 'вживаний'] }

const QUOTES = /[«»"'’`ʼ‘]/g

export function normalize(text: string): string {
  return text.toLowerCase().replace(QUOTES, '').replace(/ё/g, 'е').replace(/\s+/g, ' ').trim()
}

// Кирилиця → латиниця з кількома варіантами для неоднозначних літер (х — h/kh, г — h/g, и — y/i, ю — iu/yu…).
const TRANSLIT: Record<string, string[]> = {
  а: ['a'], б: ['b'], в: ['v'], г: ['h', 'g'], ґ: ['g'], д: ['d'], е: ['e'], є: ['ie', 'e'], ж: ['zh'], з: ['z'],
  и: ['y', 'i'], і: ['i'], ї: ['i', 'yi'], й: ['i', 'y'], к: ['k', 'c'], л: ['l'], м: ['m'], н: ['n'], о: ['o'],
  п: ['p'], р: ['r'], с: ['s'], т: ['t'], у: ['u'], ф: ['f'], х: ['h', 'kh'], ц: ['ts', 'c'], ч: ['ch'], ш: ['sh'],
  щ: ['shch'], ь: [''], ю: ['iu', 'yu'], я: ['ia', 'ya'], ы: ['y'], э: ['e'], ъ: [''],
}

/** Усі латинські варіанти слова (не більше кількох десятків — для коротких слів запиту цього досить). */
function transliterations(word: string): string[] {
  if (!/[а-яіїєґ]/.test(word)) return []
  let variants = ['']
  for (const ch of word) {
    const options = TRANSLIT[ch] ?? [ch]
    variants = variants.flatMap((v) => options.map((o) => v + o)).slice(0, 32)
  }
  return variants
}

/** Чим може бути слово запиту: саме собою, латинським родом (для «ехеверія») і транслітерацією («лола» → lola). */
function candidates(word: string): string[] {
  const genus = detectGenus(word)
  return [word, ...(genus ? [genus.toLowerCase()] : []), ...transliterations(word)]
}

export interface SearchContext {
  /** Назва категорії для показу («Горщики») — щоб знаходилось і за нею. */
  categoryName: (id: string) => string
  /** Підпис особливості («Живець», «Б/У», «Variegata»). */
  tagLabel: (tag: string) => string
}

function haystack(p: Product, ctx: SearchContext): string {
  return normalize(
    [p.name.uk, p.name.en, p.genus, ...(p.aliases ?? []), ...(p.parents ?? []), p.habitat, p.breeder, p.slug.replace(/-/g, ' '), ctx.categoryName(p.category), ...(p.tags ?? []).flatMap((t) => [t, ctx.tagLabel(t), ...(TAG_SYNONYMS[t] ?? [])])]
      .filter(Boolean)
      .join(' '),
  )
}

/** Товари, що підходять під запит: спершу ті, де збіг у назві, далі решта; відсутні на складі — в кінці. */
export function searchProducts(products: Product[], query: string, ctx: SearchContext): Product[] {
  const words = normalize(query).split(' ').filter(Boolean)
  if (words.length === 0) return []
  const wordCandidates = words.map(candidates)

  const scored: { product: Product; score: number }[] = []
  for (const product of products) {
    const text = haystack(product, ctx)
    if (!wordCandidates.every((cands) => cands.some((c) => text.includes(c)))) continue
    const name = normalize(product.name.uk)
    let score = 0
    // Назва починається з першого слова запиту — найкращий збіг.
    if (wordCandidates[0].some((c) => name.startsWith(c))) score += 3
    // Кожне слово, знайдене саме в назві (а не лише в категорії чи тегах), — ще бал.
    score += wordCandidates.filter((cands) => cands.some((c) => name.includes(c))).length
    if (product.stock <= 0) score -= 100
    scored.push({ product, score })
  }
  return scored.sort((a, b) => b.score - a.score).map((s) => s.product)
}
