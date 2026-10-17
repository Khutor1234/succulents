import type { Timestamp } from 'firebase/firestore'
import type { PlantTag } from './plants'

/** Ідентифікатор категорії (латиницею, з дефісами) — частина адреси /c/<id>. Список керується з адмінки. */
export type Category = string

/** Стартовий набір категорій, поки продавець нічого не змінював в адмінці. */
export const DEFAULT_CATEGORIES: { id: Category; name: string }[] = [
  { id: 'plants', name: 'Рослини' },
  { id: 'tools', name: 'Інструменти' },
  { id: 'pots', name: 'Горщики' },
  { id: 'soil', name: 'Ґрунтові суміші' },
  { id: 'fertilizers', name: 'Добрива' },
  { id: 'pest-control', name: 'Засоби від шкідників' },
]

export type Language = 'uk'

/**
 * Текст товару. Зараз сайт лише українською; `en` лишається необов'язковим полем,
 * щоб старі дані читались і англійську можна було повернути без міграції бази.
 */
export interface Localized {
  uk: string
  en?: string
}

export interface Product {
  id: string
  slug: string
  category: Category
  name: Localized
  description: Localized
  /** Ціна в копійках: 15000 = 150 грн. */
  price: number
  stock: number
  images: string[]
  isActive: boolean
  /** Вид (рід) рослини латиною, напр. «Echeveria». Для не-рослин порожньо. */
  genus?: string
  /** Теги: 'cutting' (живець) і стани 'variegata' | 'cristata' | 'monstrose'. */
  tags?: PlantTag[]
  /** Інші назви, під якими рослину теж знають: «Sedum morganianum», «Ослячий хвіст». Шукаються пошуком. */
  aliases?: string[]
  /** Батьки гібрида: [материнська ♀, батьківська ♂], напр. «Echeveria lilacina», «Echeveria Deresina». Лише для рослин; порожньо — не вказано. */
  parents?: string[]
  /**
   * Як рослина пов'язана з parents: 'hybrid' (за замовчуванням) — гібрид «A × B», можна знати лише одного з батьків;
   * 'cultivar' — відбір або мутація (спорт) від однієї рослини (parents[0]), напр. монстрозна форма виду;
   * 'natural' — природний вид, без батьків; природний ареал — у habitat.
   */
  origin?: PlantOrigin
  /** Природний ареал для 'natural': країна чи регіон, напр. «Мексика». */
  habitat?: string
  /** Хто вивів гібрид чи сорт: людина або розплідник/компанія, напр. «Dick Wright». Для природного виду порожньо. */
  breeder?: string
  /** Характеристики, напр. «Діаметр горщика: 8 см». */
  specs?: { label: Localized; value: Localized }[]
  createdAt?: Timestamp
}

export const ORIGINS = ['natural', 'hybrid', 'cultivar'] as const
/** Підказки для поля ареалу — найчастіші батьківщини сукулентів. */
export const HABITATS = ['Мексика', 'ПАР', 'Намібія', 'Мадагаскар', 'Канарські острови', 'США', 'Перу', 'Чилі', 'Болівія', 'Бразилія', 'Ємен', 'Китай'] as const
export type PlantOrigin = (typeof ORIGINS)[number]

export const ORDER_STATUSES = ['new', 'confirmed', 'shipped', 'done', 'cancelled'] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]
export type PaymentMethod = 'cod' | 'card_transfer'

export interface OrderItem {
  productId: string
  name: Localized
  price: number
  /** Скільки буде відправлено. */
  qty: number
  /** Скільки замовлено спочатку — є, якщо продавець змінював склад замовлення. */
  originalQty?: number
  /** Фото на момент замовлення (у старих замовлень його немає). */
  image?: string
  /** Ціна на момент замовлення — є, якщо продавець потім змінив ціну. */
  originalPrice?: number
  /** Товар додав продавець після оформлення. */
  added?: boolean
}

export interface Order {
  id: string
  number: string
  userId: string | null
  email: string
  items: OrderItem[]
  /** Сума товарів до знижки. У замовлень, створених до появи бонусів, поля немає. */
  subtotal?: number
  bonusUsed?: number
  /** Знижка (−) чи доплата (+) від продавця. */
  adjustment?: number
  adjustmentNote?: string
  /** До сплати. */
  total: number
  /** 10% від сплаченого — нараховується, коли замовлення «Виконане». */
  bonusEarned?: number
  bonusCredited?: boolean
  adjustedAt?: Timestamp
  status: OrderStatus
  delivery: { fullName: string; phone: string; city: string; warehouse: string; comment: string }
  payment: { method: PaymentMethod; paid: boolean }
  lang: Language
  createdAt?: Timestamp
}
