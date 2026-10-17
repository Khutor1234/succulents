import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import type { Language } from '../lib/types'
import { uk } from './uk'

// Сайт поки тільки українською. Тексти зібрані в uk.ts, тож друга мова додається новим файлом перекладу.
void i18n.use(initReactI18next).init({
  resources: { uk: { translation: uk } },
  lng: 'uk',
  fallbackLng: 'uk',
  interpolation: { escapeValue: false },
})

export function useLang(): Language {
  return 'uk'
}

export default i18n
