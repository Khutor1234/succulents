import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { Check, ChevronDown, Link2, Lock, X } from 'lucide-react'
import { detectGenus, parseForms, withForms } from '../../lib/plantName'
import { ICON } from '../../shared/icon'
import { HABITATS, ORIGINS } from '../../lib/types'
import { DEFAULT_GENUS, GENERA, PLANT_CATEGORY, TAG_STYLES, tagsFor, type PlantTag } from '../../lib/plants'
import { slugify } from '../../lib/slug'
import type { Product } from '../../lib/types'
import { Button, Input, Section, Select, Textarea } from '../../shared/ui'
import { useCategories } from '../catalog/categories'
import { isSlugTaken, useProductById, useSaveProduct } from './api'
import { ImagesEditor } from './ImagesEditor'
import {
  cultivarOf,
  productFormSchema,
  toFormValues,
  toProductInput,
  type ProductFormData,
  type ProductFormInput,
} from './productSchema'

/** /admin/products/new — створення, /admin/products/:id — редагування. */
export function ProductFormPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const isNew = id === 'new'
  const { data: product, isLoading } = useProductById(isNew ? undefined : id)
  const { isLoading: categoriesLoading } = useCategories()

  if ((!isNew && isLoading) || categoriesLoading) return <p className="text-sand-700">{t('loading')}</p>
  if (!isNew && !product) return <p>{t('product.notFound')}</p>

  // key: при переході між товарами форма створюється заново з новими значеннями.
  return <ProductForm key={id} product={isNew ? null : product!} />
}

function ProductForm({ product }: { product: Product | null }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const save = useSaveProduct()
  const [images, setImages] = useState<string[]>(product?.images ?? [])
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
    formState: { errors, isSubmitting },
  } = useForm<ProductFormInput, unknown, ProductFormData>({
    resolver: zodResolver(productFormSchema),
    // Новий товар з відфільтрованого списку (?category=soil) одразу отримує цю категорію.
    defaultValues: toFormValues(product, searchParams.get('category') ?? categories[0]?.id ?? ''),
  })
  const specs = useFieldArray({ control, name: 'specs' })
  // Вид і синхронізація назви — лише для рослин; теги — ті, що доступні в категорії (рослини, горщики, інструменти).
  const category = useWatch({ control, name: 'category' })
  const genusValue = useWatch({ control, name: 'genus' })
  const fullName = useWatch({ control, name: 'name.uk' })
  const slugValue = useWatch({ control, name: 'slug' })
  const origin = useWatch({ control, name: 'origin' })
  const isPlant = category === PLANT_CATEGORY
  const categoryTags = tagsFor(category)

  const err = (key?: string) => (key ? t(key) : undefined)

  async function onSubmit(data: ProductFormData) {
    if (await isSlugTaken(data.slug, product?.id)) {
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
    await save.mutateAsync({ id: product?.id, data: toProductInput(clean, images) })
    // Повертаємось до списку, відфільтрованого за категорією цього товару.
    navigate(`/admin/products?category=${data.category}`)
  }

  // Адресу, яку ми самі підставили, оновлюємо разом із назвою — поки її не змінили вручну.
  // Для вже існуючого товару адресу не чіпаємо, щоб не ламати старі посилання.
  const [autoSlug, setAutoSlug] = useState('')
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
    const base = [getValues('genus'), getValues('cultivar').trim()].filter(Boolean).join(' ')
    setValue('name.uk', withForms(base, currentTags()), { shouldDirty: true, shouldValidate: !!errors.name })
    suggestSlug()
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
    if (states.length) {
      // Вписані форми лише додають галочки; вже поставлені не знімаємо.
      setValue('tags', [...new Set([...currentTags(), ...states])], { shouldDirty: true })
    }
    const cultivar = detected ? base.split(/\s+/).slice(1).join(' ') : base
    if (cultivar !== raw) setValue('cultivar', cultivar, { shouldDirty: true })
    syncPlantName()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <h1 className="font-display text-3xl font-extrabold text-brand-600">{product ? t('admin.editProduct') : t('admin.createProduct')}</h1>

      {/* На широкому екрані — дві колонки на всю ширину: зліва назва й опис, справа фото, ціна, характеристики */}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="space-y-6">
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
              if (!getValues('cultivar')) setValue('cultivar', cultivarOf(getValues('name.uk')))
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
          <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <Select label={t('catalog.genus')} current={genusValue} {...register('genus', { onChange: syncPlantName })}>
              <option value="">{t('admin.fields.noGenus')}</option>
              {GENERA.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </Select>
            <Input
              label={t('admin.fields.cultivar')}
              placeholder="Lola"
              {...register('cultivar', { onChange: syncPlantName, onBlur: onCultivarBlur })}
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
            <div className="flex flex-wrap gap-2">
              {categoryTags.map((tag) => (
                <label
                  key={tag}
                  className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border-2 border-sand-200 bg-sand-50 px-3 has-checked:border-brand-500 has-checked:bg-brand-50"
                >
                  <input
                    type="checkbox"
                    value={tag}
                    className="h-5 w-5 accent-brand-600"
                    {...register('tags', { onChange: syncPlantName })}
                  />
                  <span className={`rounded-full px-2.5 py-0.5 text-sm font-bold ${TAG_STYLES[tag]}`}>{t(`tags.${tag}`)}</span>
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
        {/* Походження: гібрид двох рослин (можна знати лише одного з батьків) або сорт/форма від однієї рослини.
            На сайті кожне ім'я клікабельне — веде в пошук. */}
        {isPlant && (
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-sand-700">{t('admin.fields.origin')}</legend>
            <div className="mb-2 inline-flex rounded-xl bg-sand-200 p-1" role="radiogroup" aria-label={t('admin.fields.origin')}>
              {ORIGINS.map((o) => (
                <label
                  key={o}
                  className="cursor-pointer rounded-lg px-3 py-1.5 text-sm font-bold text-sand-700 transition-colors has-checked:bg-sand-50 has-checked:text-ink has-checked:shadow-sm"
                >
                  <input
                    type="radio"
                    value={o}
                    className="sr-only"
                    {...register('origin', {
                      // Найчастіше рослини з природи — з Мексики: підставляємо, якщо ареал ще порожній.
                      onChange: (e) => e.target.value === 'natural' && !getValues('habitat') && setValue('habitat', 'Мексика'),
                    })}
                  />
                  {t(`admin.fields.origins.${o}`)}
                </label>
              ))}
            </div>
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
              <Input label={t('admin.fields.cultivarOf')} className="[&>span]:sr-only" placeholder="Echeveria lilacina" {...register('parents.0')} />
            ) : (
              <div className="grid items-center gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
                <Input label={t('admin.fields.parentA')} className="[&>span]:sr-only" placeholder="Echeveria Lola" {...register('parents.0')} />
                <span className="hidden text-center font-display text-xl font-extrabold text-sand-700 sm:block" aria-hidden>
                  ×
                </span>
                <Input
                  label={t('admin.fields.parentB')}
                  className="[&>span]:sr-only"
                  placeholder={t('admin.fields.parentUnknown')}
                  {...register('parents.1')}
                />
              </div>
            )}
            <p className="mt-1.5 text-sm text-sand-700">
              {t(
                origin === 'natural'
                  ? 'admin.fields.habitatHint'
                  : origin === 'cultivar'
                    ? 'admin.fields.cultivarOfHint'
                    : 'admin.fields.parentsHint',
              )}
            </p>
            {/* Хто вивів — лише для гібрида чи відбору; у природного виду селекціонера немає */}
            {origin !== 'natural' && (
              <div className="mt-4">
                <Input label={t('admin.fields.breeder')} placeholder="Dick Wright" {...register('breeder')} />
                <p className="mt-1.5 text-sm text-sand-700">{t('admin.fields.breederHint')}</p>
              </div>
            )}
          </fieldset>
        )}
        {/* Підсумок: так назва буде на сайті. Поле лише для читання — міняється через вид, назву й галочки. */}
        {isPlant && (
          <div>
            <p className="mb-1.5 text-sm font-medium text-sand-700">{t('admin.fields.fullName')}</p>
            <output
              aria-live="polite"
              className="flex min-h-12 items-center gap-2 rounded-xl border-2 border-dashed border-brand-500 bg-brand-50 px-4 py-2.5 font-display text-lg font-bold text-brand-700"
            >
              <Lock size={16} strokeWidth={2.25} className="shrink-0 text-brand-500" aria-hidden />
              <span className="min-w-0 break-words">{fullName || '—'}</span>
            </output>
            <p className={`mt-1.5 text-sm ${errors.name?.uk ? 'text-red-700' : 'text-sand-700'}`}>
              {errors.name?.uk ? t(errors.name.uk.message ?? 'errors.required') : t('admin.fields.fullNameHint')}
            </p>
          </div>
        )}
        {/* Посилання заповнюється само з назви — тому сховане; розгортається, лише якщо з ним щось не так */}
        <details className="group rounded-xl border-2 border-sand-200 bg-sand-50" open={errors.slug ? true : undefined}>
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 text-sm font-medium text-sand-700 [&::-webkit-details-marker]:hidden">
            <Link2 size={16} strokeWidth={2.25} aria-hidden />
            {t('admin.fields.slug')}
            <span className="truncate font-normal">/product/{slugValue || '…'}</span>
            <ChevronDown size={16} strokeWidth={2.25} className="ml-auto shrink-0 transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <div className="px-3 pb-3">
            <Input
              label={t('admin.fields.slugEdit')}
              placeholder="echeveria-lola-variegata"
              {...register('slug')}
              error={err(errors.slug?.message)}
            />
            <p className="mt-1.5 text-sm text-sand-700">{t('admin.fields.slugHint')}</p>
          </div>
        </details>
        <Textarea label={t('admin.fields.descriptionUk')} rows={6} {...register('description.uk')} />
      </Section>
      </div>

      <div className="space-y-6">
      <Section title={t('admin.fields.photos')}>
        <ImagesEditor images={images} onChange={setImages} onUploadingChange={setUploading} />
      </Section>

      <Section title={t('admin.price')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={t('admin.fields.price')}
            type="number"
            step="0.01"
            min="0"
            {...register('price')}
            error={err(errors.price && 'errors.required')}
          />
          <Input label={t('admin.fields.stock')} type="number" step="1" min="0" {...register('stock')} />
        </div>
        <label className="flex items-center gap-2">
          <input type="checkbox" {...register('isActive')} /> {t('admin.fields.isActive')}
        </label>
      </Section>

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
      </div>

      {save.isError && <p className="text-red-700">{t('admin.saveError')}</p>}
      {/* На телефоні кнопки прикріплені до низу екрана — не треба гортати довгу форму до кінця */}
      <div className="sticky bottom-0 z-30 -mx-4 flex gap-3 border-t-2 border-sand-200 bg-sand-100/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <Button type="submit" disabled={isSubmitting || uploading} className="flex-1 sm:flex-none">
          <Check {...ICON} />
          {isSubmitting ? t('admin.saving') : t('admin.save')}
        </Button>
        <Link
          to={product ? `/admin/products?category=${product.category}` : '/admin/products'}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-sand-200 px-5 font-bold hover:bg-sand-300"
        >
          <X {...ICON} />
          {t('admin.cancel')}
        </Link>
      </div>
    </form>
  )
}
