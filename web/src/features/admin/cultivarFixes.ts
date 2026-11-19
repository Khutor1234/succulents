import { parseForms, withoutStates } from '../../lib/plantName'
import { PLANT_CATEGORY } from '../../lib/plants'
import type { Product } from '../../lib/types'
import { cultivarOf, plantBase, splitCultivar } from './productSchema'

/**
 * «Культивари»: слово в лапках після назви — культивар: «Echeveria chihuahuaensis 'Ruby Blush'»,
 * «Graptoveria Debbie 'test' monstrose». У формі товару воно має стояти в полі «Культивар», а не в «Вид або назва».
 * Тут його туди переносимо (поле cultivarName у товарі). Сама назва, батьки й походження не змінюються —
 * крім подвійних лапок: «Echeveria 'Champagne' 'Watermelon' variegata» → одні лапки «Echeveria 'Champagne Watermelon' variegata»,
 * і «Від» такої форми — так само («Echeveria 'Champagne Watermelon'»).
 */

export interface CultivarFix {
  id: string
  /** Мале фото рослини в списку правок */
  image?: string
  slug: string
  name: string
  /** Що лишиться в полі «Вид або назва» */
  rest: string
  /** Що стане в полі «Культивар» */
  cultivar: string
  /** Як зараз у полі «Вид або назва» */
  before: string
  /** Подвійні лапки → одні: нова назва (і «Від», якщо він ішов за назвою) */
  rename?: { name: string; parents?: string[] }
}

type Plant = Pick<Product, 'id' | 'slug' | 'name' | 'category' | 'genus' | 'cultivarName' | 'parents'> & { images?: string[] }

export function planCultivarFixes(products: Plant[]): CultivarFix[] {
  return products
    .filter((p) => p.category === PLANT_CATEGORY && parseForms(p.name.uk).base)
    .flatMap((p) => {
      const before = cultivarOf(p.name.uk, p.genus)
      const { cultivar: rest, selection } = splitCultivar(before)
      // Без назви перед лапками («Echeveria 'Lola'») — це сама назва гібрида, не культивар; уже перенесено — пропускаємо
      if (!selection) return []
      // Назва в лапках + культивар у своїх лапках («'Champagne' 'Watermelon'») — зливаємо в одні лапки
      const merged = /^['‘’"].*['‘’"]$/u.test(rest) ? plantBase('', rest, selection) : ''
      const name = merged && p.name.uk.includes(before) ? p.name.uk.replace(before, merged) : ''
      if (!name && p.cultivarName?.trim() === selection) return []
      const from = p.parents?.[0] ?? ''
      const followed = !!name && !!from && from === withoutStates(p.name.uk) && from !== withoutStates(name)
      const rename = name ? { name, ...(followed ? { parents: [withoutStates(name), ...(p.parents ?? []).slice(1)] } : {}) } : undefined
      return [{ id: p.id, slug: p.slug, name: p.name.uk, image: p.images?.[0], rest, cultivar: selection, before, rename }]
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}
