import { zodResolver } from '@hookform/resolvers/zod'
import { useRef, useState } from 'react'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { Ban, Check, CornerDownRight, Copy, CopyPlus, Eye, EyeOff, Link2, Tag, X, Trash2 } from 'lucide-react'
import type { UseFormRegisterReturn } from 'react-hook-form'
import { detectGenus, nameKey, parseForms, withCuttingMark, withForms, withoutStates } from '../../lib/plantName'
import { ICON } from '../../shared/icon'
import { HABITATS, ORIGINS } from '../../lib/types'
import { DEFAULT_GENUS, GENERA, PLANT_CATEGORY, STATE_TAGS, TAG_STYLES, tagsFor, type PlantTag } from '../../lib/plants'
import { slugify } from '../../lib/slug'
import type { Product } from '../../lib/types'
import { Button, Input, Section, Select, StepperInput, Textarea } from '../../shared/ui'
import { useCategories } from '../catalog/categories'
import { isSlugTaken, useAllProducts, useDeleteProduct, useProductById, useSaveProduct, useToggleForSale, useToggleProductActive } from './api'
import { HomePin } from '../catalog/ProductCard'
import { ListButton } from '../catalog/ListButton'
import { canGoBack, useFrom } from '../../shared/navigation'
import { BackLink } from './BackLink'
import { ImagesEditor } from './ImagesEditor'
import {
  cultivarOf,
  hasBase,
  plantBase,
  splitCultivar,
  withoutSelection,
  prefillPlant,
  productFormSchema,
  toFormValues,
  toProductInput,
  type ProductFormData,
  type ProductFormInput,
} from './productSchema'

/**
 * /admin/products/new — створення, /admin/products/:id — редагування,
 * /admin/products/new?copy=:id — новий товар, заповнений даними іншого (швидко зробити, напр., варієгатну форму).
 * /admin/products/new?name=…&origin=…&p1=…&p2=…&habitat=… — нова рослина з відомими даними (плюсик у картці «Походження»).
 */
export function ProductFormPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const isNew = id === 'new'
  const copyId = isNew ? (searchParams.get('copy') ?? undefined) : undefined
  const { data: product, isFetchedAfterMount } = useProductById(isNew ? copyId : id)
  const { isLoading: categoriesLoading } = useCategories()

  // Чекаємо свіжих даних із бази, а не показуємо збережену раніше копію: форма заповнюється один раз,
  // і зі старої копії «Зберегти» повернуло б старі фото чи залишок (напр., після «±» на картці).
  if (((!isNew || copyId) && !isFetchedAfterMount) || categoriesLoading) return <p className="text-sand-700">{t('loading')}</p>
  if (!isNew && !product) return <p>{t('product.notFound')}</p>

  // key: при переході між товарами форма створюється заново з новими значеннями.
  return <ProductForm key={`${id}-${copyId ?? ''}`} product={isNew ? null : product!} source={copyId ? (product ?? null) : null} />
}

// На скільки гривень змінюють ціну кнопки «−50» / «+50»
const PRICE_STEP = 50

// Значення пункту «+ Додати новий рід» у списку родів (не справжній рід)
const NEW_GENUS = '__new__'

function ProductForm({ product, source }: { product: Product | null; source?: Product | null }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const save = useSaveProduct()
  const [images, setImages] = useState<string[]>(product?.images ?? source?.images ?? [])
  const [uploading, setUploading] = useState(false)
  const { all: categories } = useCategories()
  const [searchParams] = useSearchParams()

  const {
    register,
    control,
    handleSubmit,
    getValues,
    setValue,
    setError,
    resetField,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProductFormInput, unknown, ProductFormData>({
    resolver: zodResolver(productFormSchema),
    // Новий товар з відфільтрованого списку (?category=soil) одразу отримує цю категорію.
    // Копія: усе як в оригіналі, крім адреси сторінки — вона складеться з назви при збереженні.
    defaultValues: source
      ? { ...toFormValues(source, source.category), slug: '' }
      : prefillPlant(searchParams, toFormValues(product, searchParams.get('category') ?? categories[0]?.id ?? '')),
  })
  const specs = useFieldArray({ control, name: 'specs' })
  // Вид і синхронізація назви — лише для рослин; теги — ті, що доступні в категорії (рослини, горщики, інструменти).
  const category = useWatch({ control, name: 'category' })
  const genusValue = useWatch({ control, name: 'genus' })
  // Роди у списку: основні + ті, що вже є в товарах (додані раніше як «новий рід») + поточний
  const { data: allProducts } = useAllProducts()
  const generaOptions = [...new Set<string>([...GENERA, ...(allProducts ?? []).map((p) => p.genus ?? '').filter(Boolean), genusValue].filter(Boolean))].sort(
    (a, b) => a.localeCompare(b),
  )
  const [addingGenus, setAddingGenus] = useState(false)
  const [newGenus, setNewGenus] = useState('')
  // Рід до вибору «+ Додати новий рід» — повертаємо його, поки нову назву не підтвердили
  const [genusBefore, setGenusBefore] = useState(genusValue)
  // Новий рід потрапляє в товар одразу під час набору (без кнопки «Додати») — і в повну назву, і при збереженні.
  // Порожнє поле — повертаємо рід, що був до вибору «+ Додати новий рід»
  function typeNewGenus(text: string) {
    setNewGenus(text)
    // «mammillaria» → «Mammillaria»: рід латиною завжди з великої літери
    const g = text.trim().replace(/\s+/g, ' ')
    setValue('genus', g ? g.charAt(0).toUpperCase() + g.slice(1) : genusBefore, { shouldDirty: true })
    syncPlantName()
  }
  // Вийшли з поля — знову список, у ньому вже є новий рід
  function finishNewGenus() {
    setGenusBefore(getValues('genus'))
    setAddingGenus(false)
  }
  const fullName = useWatch({ control, name: 'name.uk' })
  // Галочка «Живець» — у підсумку назви, як і на сайті, ще «(живець)» у дужках (у саму назву не записується)
  const watchedTags = useWatch({ control, name: 'tags' }) as unknown
  const isCutting = (Array.isArray(watchedTags) ? watchedTags : watchedTags ? [watchedTags] : []).includes('cutting')
  const slugValue = useWatch({ control, name: 'slug' })
  const [slugEditing, setSlugEditing] = useState(false)
  const origin = useWatch({ control, name: 'origin' })
  // Походження звичайної версії (для форм) — у згорнутому блоці; за замовчуванням закритий
  const tagList = Array.isArray(watchedTags) ? (watchedTags as string[]) : watchedTags ? [watchedTags as string] : []
  const baseName = useWatch({ control, name: 'parents.0' })
  const baseOrigin = useWatch({ control, name: 'baseOrigin' })
  const isPlant = category === PLANT_CATEGORY
  const categoryTags = tagsFor(category)

  const err = (key?: string) => (key ? t(key) : undefined)

  // Кнопки «−» / «+» біля ціни й кількості: не нижче нуля; ціну округлюємо до копійок
  function stepField(name: 'price' | 'stock', delta: number) {
    const next = Math.max(0, Math.round(((Number(getValues(name)) || 0) + delta) * 100) / 100)
    setValue(name, String(next), { shouldDirty: true, shouldValidate: !!errors[name] })
  }

  // «Скасувати» чи видалення — туди, звідки відкрили форму: сторінка товару, каталог, пошук
  // чи список в адмінці (з тим самим пошуком і сортуванням). Відкрили напряму — список категорії.
  // (Після збереження — завжди на сторінку товару, див. onSubmit.)
  const from = useFrom()
  function leave(category: string, { deleted = false }: { deleted?: boolean } = {}) {
    const list = `/c/${category}`
    // Видалили товар, відкритий зі сторінки товару, — тієї сторінки вже немає
    if (!from || (from.startsWith('/product/') && deleted)) return navigate(list, { replace: !!from })
    if (canGoBack()) return navigate(-1)
    navigate(from)
  }

  const remove = useDeleteProduct()
  async function onDelete() {
    if (!product || !window.confirm(t('admin.deleteProductConfirm', { name: product.name.uk }))) return
    await remove.mutateAsync(product.id)
    leave(product.category, { deleted: true })
  }

  // Іконки біля назви (як у списку товарів): показати, у продажу. У вже збереженого товару — одразу, без «Зберегти»
  // (як на картці в магазині), а у формі значення оновлюємо як збережене, щоб «Зберегти» потім не повернуло старе.
  // Новий товар — лише значення у формі, запишеться при «Зберегти».
  const toggle = useToggleProductActive()
  const toggleSale = useToggleForSale()
  const isActive = useWatch({ control, name: 'isActive' })
  const forSale = useWatch({ control, name: 'forSale' })
  const flagPending = toggle.isPending || toggleSale.isPending
  async function flip(field: 'isActive' | 'forSale') {
    const next = !getValues(field)
    if (!product) return setValue(field, next, { shouldDirty: true })
    if (field === 'isActive') await toggle.mutateAsync({ id: product.id, isActive: next })
    if (field === 'forSale') await toggleSale.mutateAsync({ id: product.id, forSale: next })
    // Поле вже не в розмітці (галочки прибрано) — тож і значення, і «збережене» значення ставимо явно
    setValue(field, next)
    resetField(field, { defaultValue: next })
  }

  // «Зберегти як новий товар»: зберігаємо форму як новий товар, а цей лишаємо без змін
  const formRef = useRef<HTMLFormElement>(null)
  const asNewRef = useRef(false)
  // Копія без жодної зміни — просто дубль, тож кнопка активна лише після правок (полів або фото)
  const changed = isDirty || images.join('|') !== (product?.images ?? []).join('|')
  function saveAsNew() {
    if (!changed) return
    asNewRef.current = true
    formRef.current?.requestSubmit()
  }

  async function onSubmit(data: ProductFormData) {
    const asNew = asNewRef.current
    asNewRef.current = false
    // Куди зберігати: у цей товар чи в новий
    const target = asNew ? null : product
    // Новому товару — власна адреса сторінки з його назви
    if (asNew) data = { ...data, slug: slugify(data.name.uk) }
    // Новий товар з автоматичною адресою, яка вже зайнята (напр., копію ще не перейменували) — додаємо -2, -3…
    if (!target && data.slug === slugify(data.name.uk) && (await isSlugTaken(data.slug))) {
      let n = 2
      while (await isSlugTaken(`${data.slug}-${n}`)) n++
      data = { ...data, slug: `${data.slug}-${n}` }
    }
    if (await isSlugTaken(data.slug, target?.id)) {
      setError('slug', { message: 'admin.slugTaken' })
      return
    }
    // Зберігаємо лише теги, доступні в категорії, і вид лише для рослин — навіть якщо їх обрали до зміни категорії.
    const allowed = tagsFor(data.category)
    const clean = {
      ...data,
      genus: data.category === PLANT_CATEGORY ? data.genus : '',
      parents: (data.category === PLANT_CATEGORY ? data.parents : ['', '']) as [string, string],
      tags: data.tags.filter((tg) => allowed.includes(tg)),
    }
    await save.mutateAsync({ id: target?.id, data: toProductInput(clean, images) })
    // Зберегли (і «як новий» теж) — одразу на сторінку цього товару, щоб побачити результат.
    // replace: «Назад» зі сторінки товару веде туди, звідки відкривали форму, а не знову у форму.
    navigate(`/product/${data.slug}`, { replace: true })
  }

  // Адресу, яку ми самі підставили, оновлюємо разом із назвою — поки її не змінили вручну.
  // Для вже існуючого товару адресу не чіпаємо, щоб не ламати старі посилання.
  // Нова рослина з плюсика (?name=…) — адресу вже підставили, вона й далі йде за назвою
  const [autoSlug, setAutoSlug] = useState(() => (product || source ? '' : getValues('slug')))
  function suggestSlug() {
    const current = getValues('slug')
    if (current && (product || current !== autoSlug)) return
    const next = slugify(getValues('name.uk'))
    setAutoSlug(next)
    setValue('slug', next)
  }

  // --- Назва рослини ↔ вид ↔ теги (тільки для категорії «Рослини») ---
  const currentTags = (): PlantTag[] => {
    const v = getValues('tags') as unknown
    return Array.isArray(v) ? (v as PlantTag[]) : v ? [v as PlantTag] : []
  }

  /**
   * Повна назва рослини = вид + назва (сорт) + форми з галочок: «Echeveria» + «Lola» + variegata →
   * «Echeveria Lola variegata». Її не редагують руками — вона перераховується після кожної зміни.
   */
  function syncPlantName() {
    if (getValues('category') !== PLANT_CATEGORY) return
    const base = plantBase(getValues('genus'), getValues('cultivar'), getValues('selection'))
    const before = getValues('name.uk')
    const name = withForms(base, currentTags())
    setValue('name.uk', name, { shouldDirty: true, shouldValidate: !!errors.name })
    // Перше поле походження, яке поставила галочка, йде за назвою: форма — «Від Echeveria Lola» (без форм),
    // лише «Hybrid» — перший батько «Echeveria Lola». Поставили галочку, а потім ввели «Lola» → там теж «Lola».
    // Культивар виду — «Від Echeveria agavoides». Вписане вручну щось інше не чіпаємо.
    const tags = currentTags()
    const states = tags.some((tg) => STATE_TAGS.includes(tg))
    const hybrid = tags.includes('hybridName')
    const selection = !states && !hybrid && !!getValues('selection').trim()
    const own = states ? withoutStates : hybrid ? (n: string) => parseForms(n).base : selection ? withoutSelection : null
    // Культивар — «Від» рід + вид/назва без культивару (так і для спільних лапок «'Monroe Black'» → «Echeveria 'Monroe'»)
    const species = plantBase(getValues('genus'), getValues('cultivar'), '')
    const target = selection ? species : own?.(name)
    const from = getValues('parents.0')
    // «Від» ще йде за назвою: збігається з попередньою назвою без культивару (у спільних лапках — її початок)
    const follows = !from.trim() || (selection ? `${nameKey(before)} `.startsWith(`${nameKey(from)} `) : nameKey(from) === nameKey(own?.(before) ?? ''))
    if (own && target && getValues('origin') === (states || selection ? 'cultivar' : 'hybrid') && follows) {
      setValue('parents.0', target, { shouldDirty: true })
      fillBaseFrom(target, from)
    }
    suggestSlug()
  }

  /**
   * Форма сама поставила «Від [рослина]» — якщо ця рослина є в магазині, її походження (батьки, «відбір від» чи природний ареал)
   * одразу йде в блок «Походження …». Лише коли блок порожній або заповнений так само автоматично з попередньої «Від»
   * (напр. змінили назву) — вписане вручну не чіпаємо.
   */
  function fillBaseFrom(source: string, prevSource = '') {
    type Lin = { origin: Product['origin'] & string; parents: [string, string]; habitat: string }
    const find = (n: string) => (n.trim() ? allProducts?.find((q) => q.id !== product?.id && nameKey(q.name.uk) === nameKey(n)) : undefined)
    const lin = (q?: Product): Lin | null => {
      if (!q) return null
      const ps = (q.parents ?? []).filter(Boolean)
      // Старі картки без типу походження, але з батьками — гібрид (як і скрізь на сайті)
      const origin = q.origin ?? (ps.length ? 'hybrid' : undefined)
      if (!origin) return null
      if (origin === 'natural') return { origin: 'natural', parents: ['', ''], habitat: q.habitat ?? '' }
      if (ps.length === 0) return null
      return { origin, parents: [ps[0], origin === 'cultivar' ? '' : (ps[1] ?? '')], habitat: '' }
    }
    const sameAs = (a: Lin | null, b: Lin) =>
      !!a && a.origin === b.origin && a.parents.map(nameKey).join('|') === b.parents.map(nameKey).join('|') && (a.origin !== 'natural' || a.habitat === b.habitat)
    const cur: Lin = { origin: getValues('baseOrigin'), parents: getValues('baseParents'), habitat: getValues('baseHabitat') }
    const empty = cur.origin !== 'natural' && !cur.parents.some((x) => x.trim())
    const auto = !!prevSource && nameKey(prevSource) !== nameKey(source) && sameAs(lin(find(prevSource)), cur)
    if (!empty && !auto) return
    const next = lin(find(source))
    const set = (l: Lin) => {
      setValue('baseOrigin', l.origin, { shouldDirty: true })
      setValue('baseParents', l.parents, { shouldDirty: true })
      setValue('baseHabitat', l.habitat, { shouldDirty: true })
    }
    if (next) set(next)
    // «Від» змінили на рослину, якої в магазині немає — автоматично вписане від попередньої прибираємо
    else if (auto) set({ origin: 'hybrid', parents: ['', ''], habitat: '' })
  }

  /**
   * Поставили галочку «Hybrid» — це гібрид без власної назви від самої цієї рослини: «Echeveria Orion hybrid» —
   * походження «Гібрид», перший батько «Echeveria Orion». Часто це копія самого Orion з його батьками — тоді
   * другого батька (батька Orion) прибираємо, його вписують, якщо відомо.
   */
  function applyHybridOrigin() {
    const self = plantBase(getValues('genus'), getValues('cultivar'), getValues('selection'))
    setValue('origin', 'hybrid', { shouldDirty: true })
    const prev = getValues('parents.0')
    if (!self || nameKey(prev) === nameKey(self)) return fillBaseFrom(self)
    setValue('parents.0', self, { shouldDirty: true })
    setValue('parents.1', '', { shouldDirty: true })
    fillBaseFrom(self, prev)
  }

  /**
   * Поставили форму (variegata, cristata, monstrose) — це відбір або мутація від звичайної версії: «Echeveria Lola cristata» —
   * «Від Echeveria Lola» (з «Hybrid» — від «Echeveria Lola hybrid»). Якщо в картці вже було походження самої Lola
   * (напр., копія її картки з батьками), переносимо його в блок «Походження Echeveria Lola», щоб не загубилось.
   * Лише «Hybrid» без форм — як і раніше, гібрид від самої рослини.
   */
  function applyFormOrigin() {
    const tags = currentTags()
    if (!tags.some((tg) => STATE_TAGS.includes(tg))) return tags.includes('hybridName') && applyHybridOrigin()
    const base = plantBase(getValues('genus'), getValues('cultivar'), getValues('selection'))
    if (!base) return
    const source = withForms(base, tags.includes('hybridName') ? ['hybridName'] : [])
    const was = getValues('origin')
    const [p0, p1] = getValues('parents')
    const baseEmpty = !getValues('baseParents').some((x) => x.trim()) && getValues('baseOrigin') !== 'natural'
    if (was !== 'cultivar' && baseEmpty) {
      if (was === 'natural') {
        setValue('baseOrigin', 'natural', { shouldDirty: true })
        setValue('baseHabitat', getValues('habitat'), { shouldDirty: true })
      } else if (was === 'hybrid' && (p0.trim() || p1.trim()) && nameKey(p0) !== nameKey(base)) {
        setValue('baseOrigin', 'hybrid', { shouldDirty: true })
        setValue('baseParents', [p0, p1], { shouldDirty: true })
      }
    }
    setValue('origin', 'cultivar', { shouldDirty: true })
    setValue('parents', [source, ''], { shouldDirty: true })
    fillBaseFrom(source, p0)
  }

  /**
   * Вписали культивар виду («agavoides» + «Maria») — це відбір від виду: «Відбір або мутація» від «Echeveria agavoides».
   * Лише без форм і «Hybrid» (тоді діють їхні правила) і коли вид вказано. Далі поле «Від» іде за назвою (syncPlantName).
   */
  function applySelectionOrigin() {
    const tags = currentTags()
    if (!getValues('selection').trim() || tags.includes('hybridName') || tags.some((tg) => STATE_TAGS.includes(tg))) return
    if (!getValues('cultivar').trim() || getValues('origin') === 'cultivar') return
    const source = [getValues('genus'), getValues('cultivar').trim()].filter(Boolean).join(' ')
    setValue('origin', 'cultivar', { shouldDirty: true })
    setValue('parents', [source, ''], { shouldDirty: true })
    fillBaseFrom(source)
  }

  /**
   * Вийшли з поля «Назва» → якщо туди вписали вид чи форми («ехеверія Lola variegated»),
   * переносимо їх у свої поля: вид — у список, форми — у галочки, а в назві лишаємо тільки «Lola».
   */
  function onCultivarBlur() {
    const raw = getValues('cultivar')
    const { base, states } = parseForms(raw)
    const detected = detectGenus(base)
    if (detected) setValue('genus', detected, { shouldDirty: true })
    const newForm = states.some((st) => !currentTags().includes(st))
    if (states.length) {
      // Вписані форми лише додають галочки; вже поставлені не знімаємо.
      setValue('tags', [...new Set([...currentTags(), ...states])], { shouldDirty: true })
    }
    // Вписали й культивар у лапках («agavoides 'Maria'») — переносимо його в поле «Культивар»
    const rest = detected ? base.split(/\s+/).slice(1).join(' ') : base
    const split = getValues('selection').trim() ? null : splitCultivar(rest)
    const cultivar = split?.selection ? split.cultivar : rest
    if (split?.selection) setValue('selection', split.selection, { shouldDirty: true })
    if (cultivar !== raw) setValue('cultivar', cultivar, { shouldDirty: true })
    syncPlantName()
    if (newForm) applyFormOrigin()
    else applySelectionOrigin()
  }

  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        // Посилання сховане й заповнюється саме — якщо воно ще порожнє (назву не чіпали), складаємо його з назви.
        if (!getValues('slug').trim()) setValue('slug', slugify(getValues('name.uk')))
        return handleSubmit(onSubmit)(e)
      }}
      // Компактніше, ніж решта адмінки: розділи (Section) з меншими відступами всередині й між собою
      className="space-y-4 [&_fieldset.rounded-3xl]:space-y-3 [&_fieldset.rounded-3xl]:px-4 [&_fieldset.rounded-3xl]:pt-2 [&_fieldset.rounded-3xl]:pb-4"
    >
      {/* На телефоні верхнього меню адмінки немає — повернутися до списку можна стрілкою (або хрестиком унизу) */}
      <BackLink fallback={product ? `/c/${product.category}` : '/admin'} />
      {/* Зверху — повна назва, як буде на сайті (складається сама з полів нижче); над нею дрібно — «Редагування товару» */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        {/* Телефон: назва на всю ширину, іконки — рядком під нею; ширше — іконки праворуч */}
        <div className="min-w-0 basis-full sm:basis-0 sm:flex-1">
          <p className="text-xs font-bold tracking-wider text-sand-700 uppercase">{product ? t('admin.editProduct') : t('admin.createProduct')}</p>
          <h1 aria-live="polite" className="mt-1 font-display text-2xl leading-tight font-extrabold break-words text-brand-600 sm:text-4xl">
            {fullName?.trim() ? withCuttingMark(fullName, isCutting, t('product.cuttingMark')) : <span className="text-sand-400">{t('admin.fields.noName')}</span>}
          </h1>
          {errors.name?.uk && <p className="mt-1 text-sm text-red-700">{t(errors.name.uk.message ?? 'errors.required')}</p>}
        </div>
        {/* Іконки праворуч від назви — у тому ж порядку, що й у списку товарів: показати, у продажу, на головну, до списку, видалити */}
        <div className="flex flex-wrap gap-1.5">
          <FlagButton
            on={!!isActive}
            onClick={() => flip('isActive')}
            disabled={flagPending}
            label={t(isActive ? 'admin.hide' : 'admin.show')}
            icon={isActive ? <Eye {...ICON} /> : <EyeOff {...ICON} />}
          />
          <FlagButton
            on={!!forSale}
            onClick={() => flip('forSale')}
            disabled={flagPending}
            label={t(forSale ? 'admin.unsell' : 'admin.sell')}
            icon={forSale ? <Tag {...ICON} /> : <Ban {...ICON} />}
          />
          {product && <HomePin product={product} name={product.name.uk} className="!h-11 !w-11" compact />}
          {product && <ListButton product={product} name={product.name.uk} big />}
          {product && (
            <button
              type="button"
              onClick={onDelete}
              disabled={remove.isPending}
              title={t('admin.deleteProduct')}
              aria-label={t('admin.deleteProduct')}
              className="flex h-11 w-11 items-center justify-center rounded-xl border-2 border-red-700 text-red-700 transition-colors hover:bg-red-700 hover:text-sand-50 disabled:opacity-50"
            >
              <Trash2 {...ICON} />
            </button>
          )}
        </div>
      </div>
      {(remove.isError || toggle.isError || toggleSale.isError) && <p className="text-sm text-red-700">{t('admin.saveError')}</p>}
      {source && (
        <p className="flex items-start gap-2 rounded-2xl border-2 border-sunset-500/40 bg-sunset-100/60 p-4 text-sm leading-relaxed">
          <Copy size={18} strokeWidth={2.25} className="mt-0.5 shrink-0 text-sunset-600" aria-hidden />
          <span>{t('admin.copyHint', { name: source.name.uk })}</span>
        </p>
      )}

      {/* Телефон: спершу фото, ціна й залишок (найчастіше змінюють саме їх), далі назва, опис і характеристики.
          Широкий екран: дві колонки — зліва назва й опис, справа фото, ціна, характеристики. */}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:grid-rows-[auto_1fr] [&>*]:min-w-0">
      <div className="space-y-4 lg:col-start-1 lg:row-span-2 lg:row-start-1">
      <Section title={t('admin.name')}>
        <Select
          label={t('admin.fields.category')}
          current={category}
          {...register('category', {
            // Перемкнули на «Рослини», а вид ще не вибрано — одразу ставимо найпоширеніший, Echeveria.
            onChange: (e) => {
              if (e.target.value !== PLANT_CATEGORY) return
              if (!getValues('genus')) setValue('genus', DEFAULT_GENUS)
              // Звичайну назву переносимо в «Назву» рослини (без виду й форм).
              if (!getValues('cultivar')) setValue('cultivar', cultivarOf(getValues('name.uk'), getValues('genus')))
              syncPlantName()
            },
          })}
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.visible ? c.name : `${c.name} (${t('admin.hidden').toLowerCase()})`}
            </option>
          ))}
        </Select>
        {/* Рослина: окремо вид і назва (сорт), форми — галочками нижче, а повна назва складається сама */}
        {isPlant ? (
          <div className="grid gap-4 sm:grid-cols-3">
            {/* Рід: зі списку (основні роди + ті, що вже є в товарах) або новий — пунктом «+ Додати новий рід» */}
            {addingGenus ? (
              <Input
                label={t('catalog.genus')}
                autoFocus
                value={newGenus}
                onChange={(e) => typeNewGenus(e.target.value)}
                onBlur={finishNewGenus}
                onKeyDown={(e) => {
                  // Enter — не зберігати всю форму, а лише закінчити з родом
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    e.currentTarget.blur()
                  }
                }}
                placeholder="Mammillaria"
              />
            ) : (
              <Select
                label={t('catalog.genus')}
                current={genusValue}
                {...register('genus', {
                  onChange: (e) => {
                    if (e.target.value === NEW_GENUS) {
                      // Пункт «+ Додати новий рід» — не значення, а відкриття поля для назви
                      setValue('genus', genusBefore)
                      setNewGenus('')
                      setAddingGenus(true)
                      return
                    }
                    setGenusBefore(e.target.value)
                    syncPlantName()
                  },
                })}
              >
                <option value="">{t('admin.fields.noGenus')}</option>
                {generaOptions.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
                <option value={NEW_GENUS}>{t('admin.fields.genusNew')}</option>
              </Select>
            )}
            <Input
              label={t('admin.fields.cultivar')}
              placeholder="Lola"
              {...register('cultivar', { onChange: syncPlantName, onBlur: onCultivarBlur })}
            />
            {/* Культивар виду — у назві в лапках; сам ставить «Відбір або мутація» від виду */}
            <Input
              label={t('admin.fields.selection')}
              placeholder="Maria"
              {...register('selection', {
                onChange: () => {
                  syncPlantName()
                  applySelectionOrigin()
                },
              })}
            />
          </div>
        ) : (
          <Input
            label={t('admin.fields.nameUk')}
            {...register('name.uk', { onBlur: suggestSlug })}
            error={err(errors.name?.uk?.message)}
          />
        )}
        {categoryTags.length > 0 && (
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-sand-700">{t('admin.fields.tags')}</legend>
            {/* П'ять тегів рослини — в один рядок на всю ширину: кожен розтягується, скільки є місця */}
            <div className="flex flex-wrap gap-1.5">
              {categoryTags.map((tag) => (
                <label
                  key={tag}
                  className={`flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border-2 border-transparent px-2 text-[13px] font-bold whitespace-nowrap has-checked:border-brand-600 ${TAG_STYLES[tag]}`}
                >
                  <input
                    type="checkbox"
                    value={tag}
                    className="h-4 w-4 accent-brand-600"
                    {...register('tags', {
                      onChange: (e) => {
                        syncPlantName()
                        if (e.target.checked && e.target.value !== 'cutting') applyFormOrigin()
                      },
                    })}
                  />
                  {t(`tags.${tag}`)}
                </label>
              ))}
            </div>
            {isPlant && <p className="mt-2 text-sm text-sand-700">{t('admin.fields.tagsHint')}</p>}
          </fieldset>
        )}
        {/* Інші назви — синоніми й народні назви; за ними теж знаходить пошук */}
        <div>
          <Input
            label={t('admin.fields.aliases')}
            placeholder={isPlant ? 'Sedum morganianum, Ослячий хвіст' : undefined}
            {...register('aliases')}
          />
          <p className="mt-1.5 text-sm text-sand-700">{t('admin.fields.aliasesHint')}</p>
        </div>
      </Section>

      {/* Походження — окремим розділом: тип, батьки (і батьки звичайної версії форми — одразу під ними), у кінці селекціонер */}
      {isPlant && (
        <Section title={t('admin.fields.origin')}>
          <OriginPicker
            label={t('admin.fields.origin')}
            register={register('origin', {
              // Найчастіше рослини з природи — з Мексики: підставляємо, якщо ареал ще порожній.
              onChange: (e) => e.target.value === 'natural' && !getValues('habitat') && setValue('habitat', 'Мексика'),
            })}
          />
          <div>
            {origin === 'natural' ? (
              <>
                <Input label={t('admin.fields.habitat')} list="habitats" placeholder="Мексика" {...register('habitat')} />
                <datalist id="habitats">
                  {HABITATS.map((h) => (
                    <option key={h} value={h} />
                  ))}
                </datalist>
              </>
            ) : origin === 'cultivar' ? (
              <Input label={t('admin.fields.cultivarOf')} placeholder="Echeveria lilacina" {...register('parents.0')} />
            ) : (
              <ParentsInputs a={register('parents.0')} b={register('parents.1')} placeholderA="Echeveria Lola" />
            )}
            <p className="mt-1.5 text-sm text-sand-700">
              {t(origin === 'natural' ? 'admin.fields.habitatHint' : origin === 'cultivar' ? 'admin.fields.cultivarOfHint' : 'admin.fields.parentsHint')}
            </p>
          </div>
          {/* Форма (variegata…) чи «hybrid»: звідки сама звичайна версія — одразу під «Від», стрілкою, як на сторінці товару */}
          {hasBase(origin, baseName ?? '', tagList) && (
            <div className="flex gap-1.5">
              <CornerDownRight size={22} strokeWidth={2.5} className="mt-2 shrink-0 text-sunset-600" aria-hidden />
              <div className="min-w-0 flex-1 space-y-3 rounded-2xl bg-sand-100 p-3">
                <p className="text-sm font-bold text-sand-700">{t('admin.fields.baseTitle', { name: baseName })}</p>
                <OriginPicker
                  small
                  label={t('admin.fields.baseTitle', { name: baseName })}
                  register={register('baseOrigin', {
                    onChange: (e) => e.target.value === 'natural' && !getValues('baseHabitat') && setValue('baseHabitat', 'Мексика'),
                  })}
                />
                {baseOrigin === 'natural' ? (
                  <Input label={t('admin.fields.habitat')} list="habitats" placeholder="Мексика" {...register('baseHabitat')} />
                ) : baseOrigin === 'cultivar' ? (
                  <Input label={t('admin.fields.cultivarOf')} placeholder="Echeveria lilacina" {...register('baseParents.0')} />
                ) : (
                  <ParentsInputs a={register('baseParents.0')} b={register('baseParents.1')} placeholderA="Echeveria elegans" />
                )}
                <p className="text-xs text-sand-700">{t('admin.fields.baseHint', { name: baseName })}</p>
              </div>
            </div>
          )}
          {/* Хто вивів — у самому кінці; у природного виду селекціонера немає */}
          {origin !== 'natural' && (
            <div className="border-t-2 border-sand-200 pt-4">
              <Input label={t('admin.fields.breeder')} placeholder="Dick Wright" {...register('breeder')} />
              <p className="mt-1.5 text-sm text-sand-700">{t('admin.fields.breederHint')}</p>
            </div>
          )}
        </Section>
      )}

      <Section title={t('admin.fields.specs')}>
        {specs.fields.map((field, i) => (
          <div key={field.id} className="grid gap-2 rounded-lg bg-sand-100 p-3 sm:grid-cols-2">
            <Input label={t('admin.fields.specLabelUk')} placeholder="Діаметр горщика" {...register(`specs.${i}.label.uk`)} />
            <Input label={t('admin.fields.specValueUk')} placeholder="8 см" {...register(`specs.${i}.value.uk`)} />
            <button type="button" className="text-left text-sm text-red-700" onClick={() => specs.remove(i)}>
              {t('admin.fields.removePhoto')}
            </button>
          </div>
        ))}
        {errors.specs && <p className="text-sm text-red-700">{t('errors.required')}</p>}
        <Button
          variant="secondary"
          onClick={() => specs.append({ label: { uk: '' }, value: { uk: '' } })}
        >
          {t('admin.fields.addSpec')}
        </Button>
      </Section>
      </div>

      <div className="order-first space-y-4 lg:order-none lg:col-start-2 lg:row-start-1">
      <Section title={t('admin.fields.photos')}>
        <ImagesEditor images={images} onChange={setImages} onUploadingChange={setUploading} />
      </Section>

      <Section title={t('admin.price')}>
        {/* Одне під одним: колонка вузька, а кнопкам «−» / «+» і числу між ними потрібне місце */}
        <div className="grid gap-4">
          <StepperInput
            label={t('admin.fields.price')}
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            {...register('price')}
            error={err(errors.price && 'errors.required')}
            by={PRICE_STEP}
            onStep={(d) => stepField('price', d)}
            minusLabel={t('admin.priceMinus', { amount: PRICE_STEP })}
            plusLabel={t('admin.pricePlus', { amount: PRICE_STEP })}
          />
          <StepperInput
            label={t('admin.fields.stock')}
            type="number"
            inputMode="numeric"
            step="1"
            min="0"
            {...register('stock')}
            by={1}
            onStep={(d) => stepField('stock', d)}
            minusLabel={t('cart.decrease')}
            plusLabel={t('cart.increase')}
          />
        </div>
      </Section>
      </div>

      <div className="lg:col-start-2 lg:row-start-2">
      <Section title={t('admin.fields.descriptionUk')}>
        <Textarea label={t('admin.fields.descriptionUk')} className="[&>span]:sr-only" rows={6} {...register('description.uk')} />
      </Section>
      </div>
      </div>

      {/* Адреса сторінки — дрібною приміткою внизу форми, над «Зберегти» (складається сама з назви, правлять її рідко) */}
      {slugEditing || errors.slug ? (
        <div className="max-w-md">
          <Input label={t('admin.fields.slugEdit')} placeholder="echeveria-lola-variegata" {...register('slug')} error={err(errors.slug?.message)} />
          <p className="mt-1 text-xs text-sand-700">{t('admin.fields.slugHint')}</p>
        </div>
      ) : (
        <p className="flex min-w-0 items-center gap-1 text-xs text-sand-600">
          <Link2 size={12} strokeWidth={2.25} className="shrink-0" aria-hidden />
          <span className="truncate">/product/{slugValue || '…'}</span>
          <button type="button" onClick={() => setSlugEditing(true)} className="shrink-0 underline decoration-dotted underline-offset-2 hover:text-brand-600">
            {t('admin.fields.slugChange')}
          </button>
        </p>
      )}
      {save.isError && <p className="text-red-700">{t('admin.saveError')}</p>}
      {/* На телефоні кнопки прикріплені до низу екрана — не треба гортати довгу форму до кінця */}
      <div className="sticky bottom-0 z-30 -mx-4 flex gap-3 border-t-2 border-sand-200 bg-sand-100/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <Button type="submit" disabled={isSubmitting || uploading} className="min-w-0 flex-1 basis-0 whitespace-nowrap sm:flex-none sm:basis-auto">
          <Check {...ICON} />
          {isSubmitting ? t('admin.saving') : t('admin.save')}
        </Button>
        {/* Змінили щось (напр., поставили Variegata) і хочете окремий товар — оригінал лишиться як був */}
        {product && (
          <button
            type="button"
            onClick={saveAsNew}
            disabled={isSubmitting || uploading || !changed}
            title={t(changed ? 'admin.saveAsNewHint' : 'admin.saveAsNewNoChanges')}
            className="inline-flex min-h-11 min-w-0 flex-1 basis-0 items-center justify-center gap-1.5 rounded-xl border-2 border-brand-600 px-2 font-bold whitespace-nowrap sm:basis-auto text-brand-600 hover:bg-brand-600 hover:text-sand-50 disabled:opacity-50 sm:flex-none"
          >
            <CopyPlus {...ICON} />
            <span className="sm:hidden">{t('admin.saveAsNewShort')}</span>
            <span className="hidden sm:inline">{t('admin.saveAsNew')}</span>
          </button>
        )}
        {/* «Скасувати» — без збереження назад, звідки відкрили форму */}
        <button
          type="button"
          onClick={() => leave(product?.category ?? getValues('category'))}
          aria-label={t('admin.cancel')}
          title={t('admin.cancel')}
          className="inline-flex min-h-11 w-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-sand-200 font-bold hover:bg-sand-300 sm:w-auto sm:px-5"
        >
          <X {...ICON} />
          {/* На телефоні — лише хрестик, щоб усі кнопки влізли в рядок */}
          <span className="hidden sm:inline">{t('admin.cancel')}</span>
        </button>
      </div>
    </form>
  )
}

/** Тип походження перемикачем: природний вид / гібрид / відбір або мутація. `small` — для вкладеного блоку звичайної версії. */
function OriginPicker({ register, label, small = false }: { register: UseFormRegisterReturn; label: string; small?: boolean }) {
  const { t } = useTranslation()
  return (
    <div className={`inline-flex max-w-full flex-wrap rounded-xl p-1 ${small ? 'bg-sand-200/70' : 'bg-sand-200'}`} role="radiogroup" aria-label={label}>
      {ORIGINS.map((o) => (
        <label
          key={o}
          className={`cursor-pointer rounded-lg font-bold text-sand-700 transition-colors has-checked:bg-sand-50 has-checked:text-ink has-checked:shadow-sm ${small ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm'}`}
        >
          <input type="radio" value={o} className="sr-only" {...register} />
          {t(`admin.fields.origins.${o}`)}
        </label>
      ))}
    </div>
  )
}

/** Два батьки через «×»: на телефоні одне під одним, ширше — в один ряд. */
function ParentsInputs({ a, b, placeholderA }: { a: UseFormRegisterReturn; b: UseFormRegisterReturn; placeholderA: string }) {
  const { t } = useTranslation()
  return (
    <div className="grid items-end gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
      <Input label={t('admin.fields.parentA')} placeholder={placeholderA} {...a} />
      <span className="hidden pb-3 text-center font-display text-xl font-extrabold text-sunset-600 sm:block" aria-hidden>
        ×
      </span>
      <Input label={t('admin.fields.parentB')} placeholder={t('admin.fields.parentUnknown')} {...b} />
    </div>
  )
}

/** Іконка-перемикач біля назви (як у списку товарів): увімкнено — зелена зафарбована, вимкнено — контур. */
function FlagButton({ on, onClick, disabled, label, icon }: { on: boolean; onClick: () => void; disabled?: boolean; label: string; icon: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={on}
      title={label}
      aria-label={label}
      className={`flex h-11 w-11 items-center justify-center rounded-xl border-2 transition-colors disabled:opacity-50 ${
        on ? 'border-brand-600 bg-brand-600 text-sand-50 hover:bg-brand-700' : 'border-sand-700 text-sand-700 hover:bg-sand-200'
      }`}
    >
      {icon}
    </button>
  )
}
