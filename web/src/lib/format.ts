import type { Language, Localized } from './types'

const LOCALES: Record<Language, string> = { uk: 'uk-UA' }

export function formatPrice(kopecks: number, lang: Language): string {
  return new Intl.NumberFormat(LOCALES[lang], {
    style: 'currency',
    currency: 'UAH',
    maximumFractionDigits: kopecks % 100 === 0 ? 0 : 2,
  }).format(kopecks / 100)
}

/** Бере переклад поточною мовою, з запасним варіантом українською. */
export function pick(text: Localized | undefined, lang: Language): string {
  if (!text) return ''
  return text[lang] ?? text.uk
}
