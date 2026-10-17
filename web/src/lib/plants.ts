/** id категорії «Рослини». Вид і теги стосуються лише товарів цієї категорії. */
export const PLANT_CATEGORY = 'plants'

/**
 * Роди (genus) сукулентів — з колонки «Genus» таблиці рослин продавця.
 * На сайті показуються як «Вид»; латиною, бо так їх шукають колекціонери.
 */
export const GENERA = [
  'Aeonium',
  'Corpuscularia',
  'Cotyledon',
  'Crassula',
  'Echeveria',
  'Graptopetalum',
  'Graptoveria',
  'Greenovia',
  'Haworthia',
  'Kalanchoe',
  // Немає в таблиці продавця, але популярний рід (є в каталозі — «Живі камінці»)
  'Lithops',
  'Pachyphytum',
  'Pachysedum',
  'Pachyveria',
  'Sedeveria',
  'Sedum',
  'Senecio',
] as const

/** Вид за замовчуванням для нової рослини — у таблиці продавця це ~40% усіх рослин. */
export const DEFAULT_GENUS = 'Echeveria'

/** id категорії «Горщики». */
export const POTS_CATEGORY = 'pots'

/**
 * Усі теги товарів. Які з них доступні — залежить від категорії (див. TAGS_BY_CATEGORY):
 * - рослини: «Зріз» (продається зріз, а не вкорінена рослина) і форми — variegata, cristata, monstrose, hybrid;
 * - горщики й інструменти: «Б/У» (вживане).
 */
export const ALL_TAGS = ['cutting', 'variegata', 'cristata', 'monstrose', 'hybrid', 'used'] as const
export type PlantTag = (typeof ALL_TAGS)[number]

export const PLANT_TAGS: PlantTag[] = ['cutting', 'variegata', 'cristata', 'monstrose', 'hybrid']

/** Теги, доступні в категорії; для решти категорій тегів немає. */
export const TAGS_BY_CATEGORY: Record<string, PlantTag[]> = {
  [PLANT_CATEGORY]: PLANT_TAGS,
  [POTS_CATEGORY]: ['used'],
  tools: ['used'],
}
export const tagsFor = (category: string): PlantTag[] => TAGS_BY_CATEGORY[category] ?? []

/** Форми, що пишуться латиною в кінці назви (f. variegata …). «Зріз» — лише українською, у назву не йде. */
export const STATE_TAGS: PlantTag[] = ['variegata', 'cristata', 'monstrose', 'hybrid']

/** Насичені кольори кружечків у фільтрах — тих самих відтінків, що й бейджі, але помітні на світлому фоні. */
export const TAG_DOTS: Record<PlantTag, string> = {
  cutting: 'bg-[#a8865a]',
  variegata: 'bg-[#d9b400]',
  cristata: 'bg-brand-500',
  monstrose: 'bg-[#8e4aa8]',
  hybrid: 'bg-[#2f6fa8]',
  used: 'bg-[#7a6a58]',
}

/** Кольори бейджів: зріз — нейтральний пісок, стани — помітні. */
export const TAG_STYLES: Record<PlantTag, string> = {
  cutting: 'bg-sand-200 text-ink',
  variegata: 'bg-[#f3e7a8] text-[#5c4a00]',
  cristata: 'bg-brand-100 text-brand-700',
  monstrose: 'bg-[#ead7f0] text-[#5a2a6e]',
  hybrid: 'bg-[#d6e6f5] text-[#1d4a73]',
  used: 'bg-[#e8e0d5] text-[#4a3f33]',
}
