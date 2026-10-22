import { z } from 'zod'
import { detectGenus, parseForms } from '../../lib/plantName'
import { ALL_TAGS, DEFAULT_GENUS, PLANT_CATEGORY } from '../../lib/plants'
import { ORIGINS, type Product } from '../../lib/types'
import type { ProductInput } from './api'

const localized = (required: boolean) =>
  z.object({
    uk: required ? z.string().trim().min(1, 'errors.required') : z.string().trim(),
    // Англійської на сайті зараз немає; старі значення в базі просто зберігаються як є.
    en: z.string().trim().optional(),
  })

export const productFormSchema = z.object({
  category: z.string().min(1, 'errors.required'),
  name: localized(true),
  description: localized(false),
  slug: z
    .string()
    .trim()
    .min(1, 'errors.required')
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'admin.fields.slugHint'),
  price: z.coerce.number<string>().positive('errors.required').max(1_000_000),
  stock: z.coerce.number<string>().int().min(0),
  isActive: z.boolean(),
  /** Продається: вимкнено — покупці бачать «немає в наявності», продавець — справжній залишок. */
  forSale: z.boolean(),
  /** '' — вид не вказано (напр. для ґрунту чи інструменту). */
  genus: z.string(),
  /** Лише у формі: сорт/назва рослини без виду й форм («Lola»). Повна назва складається з виду, сорту й форм. */
  cultivar: z.string(),
  /** Інші назви одним рядком через кому; при збереженні стають списком. */
  aliases: z.string().max(500),
  /** Двоє батьків (гібрид): «Echeveria Lola» × «Echeveria Romeo». Порожні рядки — не вказано. */
  parents: z.tuple([z.string().trim().max(120), z.string().trim().max(120)]),
  /** Гібрид (один чи двоє батьків) або сорт від однієї рослини. */
  origin: z.enum(ORIGINS),
  /** Країна природного ареалу (лише для «З природи»). */
  habitat: z.string().trim().max(80),
  /** Селекціонер: людина чи компанія, що вивела гібрид або сорт. */
  breeder: z.string().trim().max(120),
  // Група галочок у react-hook-form: жодної — false, одна чи більше — масив значень.
  tags: z.preprocess((v) => (Array.isArray(v) ? v : v ? [v] : []), z.array(z.enum(ALL_TAGS))),
  specs: z.array(z.object({ label: localized(true), value: localized(true) })),
})

export type ProductFormInput = z.input<typeof productFormSchema>
export type ProductFormData = z.output<typeof productFormSchema>

export function toFormValues(p: Product | null, defaultCategory: string): ProductFormInput {
  const category = p?.category ?? defaultCategory
  const newPlant = !p && category === PLANT_CATEGORY
  return {
    category,
    // Для рослин назву складає форма (вид + сорт + форми); у нового товару — поки лише вид.
    name: p?.name ?? { uk: newPlant ? DEFAULT_GENUS : '' },
    description: p?.description ?? { uk: '' },
    slug: p?.slug ?? '',
    price: p ? String(p.price / 100) : '',
    stock: p ? String(p.stock) : '0',
    // Новий товар спершу прихований і не на продаж — продавець вмикає, коли все готово.
    isActive: p?.isActive ?? false,
    forSale: p ? p.forSale !== false : false,
    // Нова рослина одразу з видом Echeveria; у вже існуючого товару лишаємо те, що збережено.
    genus: p ? (p.genus ?? '') : newPlant ? DEFAULT_GENUS : '',
    tags: p?.tags ?? [],
    aliases: (p?.aliases ?? []).join(', '),
    parents: [p?.parents?.[0] ?? '', p?.parents?.[1] ?? ''],
    origin: p?.origin ?? 'hybrid',
    habitat: p?.habitat ?? '',
    breeder: p?.breeder ?? '',
    cultivar: p && category === PLANT_CATEGORY ? cultivarOf(p.name.uk) : '',
    specs: p?.specs ?? [],
  }
}

/** «Ослячий хвіст, Sedum morganianum; burro's tail» → три назви без повторів і порожніх. */
export function splitAliases(text: string): string[] {
  const seen = new Set<string>()
  return text
    .split(/[,;\n]/)
    .map((s) => s.trim().replace(/\s+/g, ' '))
    .filter((s) => s && !seen.has(s.toLowerCase()) && seen.add(s.toLowerCase()))
}

/** Сорт зі збереженої назви: «Echeveria Lola variegata» → «Lola» (вид і форми відкидаємо). */
export function cultivarOf(name: string): string {
  const { base } = parseForms(name)
  return detectGenus(base) ? base.split(/\s+/).slice(1).join(' ') : base
}

export function toProductInput({ cultivar: _cultivar, ...data }: ProductFormData, images: string[]): ProductInput {
  return {
    ...data,
    aliases: splitAliases(data.aliases),
    // Сорт походить від однієї рослини — другого батька не зберігаємо, навіть якщо його вписали до перемикання.
    // Природна рослина батьків не має; сорт — лише одну вихідну рослину.
    parents: (data.origin === 'natural' ? [] : data.origin === 'cultivar' ? data.parents.slice(0, 1) : data.parents).filter(Boolean),
    habitat: data.origin === 'natural' ? data.habitat : '',
    // Природний вид ніхто не «виводив» — селекціонера в нього немає.
    breeder: data.origin === 'natural' ? '' : data.breeder,
    // Ціна в базі — у копійках, щоб не було помилок округлення.
    price: Math.round(data.price * 100),
    images,
  }
}
