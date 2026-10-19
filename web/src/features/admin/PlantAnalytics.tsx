import {
  Baby,
  Banknote,
  Camera,
  Copy,
  Crown,
  Dna,
  Gem,
  Globe2,
  Layers,
  Leaf,
  Palette,
  Ruler,
  Sparkles,
  SpellCheck,
  Sprout,
  Tag,
  UserRound,
  Warehouse,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useLang } from '../../i18n'
import { formatPrice } from '../../lib/format'
import { baseKey, editDistance, nameKey, parseForms } from '../../lib/plantName'
import { PLANT_CATEGORY, STATE_TAGS, TAG_DOTS } from '../../lib/plants'
import type { Product } from '../../lib/types'
import { originOf } from '../catalog/usePlantFilters'
import { Card, Fact, RankList, Tile } from './analyticsUi'
import { useAllProducts } from './api'

const SCOPES = ['all', 'shown'] as const
// Скільки «родин назв» показуємо до «Показати всі»
const FAMILIES = 12
type Scope = (typeof SCOPES)[number]

// Слова з назв сортів → колір. Англійські й латинські (rubra — червона, alba — біла).
const COLORS: { id: string; swatch: string; words: string[] }[] = [
  { id: 'blue', swatch: '#5b8fc9', words: ['blue', 'azul', 'azure', 'sky', 'indigo', 'glauca', 'navy', 'ocean'] },
  { id: 'black', swatch: '#2b2118', words: ['black', 'dark', 'noir', 'night', 'midnight', 'shadow', 'vader', 'nigra', 'nigricans', 'ebony'] },
  { id: 'red', swatch: '#c0392b', words: ['red', 'ruby', 'scarlet', 'crimson', 'fire', 'flame', 'cherry', 'berry', 'rubra', 'rubrum', 'wine', 'blood'] },
  { id: 'pink', swatch: '#e48aa6', words: ['pink', 'rose', 'rosa', 'blush', 'coral', 'peach', 'rosea', 'flamingo'] },
  { id: 'white', swatch: '#e9e4d8', words: ['white', 'snow', 'snowball', 'ice', 'frost', 'pearl', 'moon', 'cream', 'silver', 'alba', 'album', 'milk', 'crystal'] },
  { id: 'gold', swatch: '#d9b400', words: ['gold', 'golden', 'lemon', 'yellow', 'sun', 'sunny', 'honey', 'champagne', 'aurea', 'banana', 'amber'] },
  { id: 'green', swatch: '#4f8a5b', words: ['green', 'lime', 'mint', 'jade', 'emerald', 'olive', 'viridis'] },
  { id: 'purple', swatch: '#8e4aa8', words: ['purple', 'lilac', 'violet', 'lavender', 'plum', 'purpurea', 'grape'] },
]
// «Королівські» слова — окремий веселий факт
const ROYAL = ['prince', 'princess', 'king', 'queen', 'lady', 'duke', 'duchess', 'emperor', 'empress', 'baron', 'royal', 'knight', 'lord']
// Службові слова, які не роблять «родину» назв
const STOP = new Set(['var', 'var.', 'subsp', 'subsp.', 'ssp', 'hybrid', 'hyb', 'mix', 'sp', 'sp.', 'x', '×', 'and', 'the', 'big', 'mini', 'small', 'large'])

const plain = (s: string) => s.replace(/['‘’"«»]/g, '').trim()

/** «Echeveria 'Black Prince' variegata» → рід Echeveria, сорт «Black Prince», слова сорту. */
function describe(p: Product) {
  const base = plain(parseForms(p.name.uk).base)
  const [first = '', ...rest] = base.split(/\s+/)
  const genus = p.genus || first
  const cultivar = (first === genus ? rest : base.split(/\s+/)).join(' ')
  const words = cultivar.split(/[\s,()-]+/).filter(Boolean)
  return { base, genus, cultivar, words }
}

const genusOf = (name: string) => plain(name).split(/\s+/)[0] ?? ''

function count<T>(map: Map<T, number>, key: T, n = 1) {
  map.set(key, (map.get(key) ?? 0) + n)
}
const top = <T,>(map: Map<T, number>, n: number) => [...map].sort((a, b) => b[1] - a[1]).slice(0, n)

export function PlantAnalytics() {
  const { t } = useTranslation()
  const lang = useLang()
  const { data: products, isLoading, isError } = useAllProducts()
  const [scope, setScope] = useState<Scope>('all')
  const [allFamilies, setAllFamilies] = useState(false)

  const stats = useMemo(() => {
    if (!products) return null
    const plants = products.filter((p) => p.category === PLANT_CATEGORY && (scope === 'all' || p.isActive))
    if (plants.length === 0) return null
    const info = new Map(plants.map((p) => [p.id, describe(p)]))
    const d = (p: Product) => info.get(p.id)!

    // Форми: кожна рахується окремо; «звичайні» — без жодної форми
    const forms = new Map<string, number>()
    let plainCount = 0
    let doubleForm = 0
    for (const p of plants) {
      const states = STATE_TAGS.filter((s) => p.tags?.includes(s))
      if (states.length === 0) plainCount++
      if (states.length > 1) doubleForm++
      states.forEach((s) => count(forms, s))
    }
    const cuttings = plants.filter((p) => p.tags?.includes('cutting')).length

    const origins = new Map<string, number>()
    plants.forEach((p) => count(origins, originOf(p) ?? 'unknown'))
    const genera = new Map<string, number>()
    plants.forEach((p) => count(genera, d(p).genus))

    // Родини назв: слово сорту (Prince, Blue, Rose…), що трапляється в кількох різних сортах
    // Слово без різниці регістру («Red prince» і «Black Prince» — одна родина); сорт — без різниці пробілів і дужок,
    // щоб «Rain Drops (Hearts Delight)» і «Rain Drops(Hearts Delight)» рахувались як один.
    const families = new Map<string, { word: string; names: Map<string, string> }>()
    const colorBases = new Map<string, Set<string>>()
    const royals = new Set<string>()
    for (const p of plants) {
      const { words, cultivar, base } = d(p)
      if (!cultivar) continue
      const cultivarKey = cultivar.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
      for (const w of words) {
        const key = w.toLowerCase()
        if (w.length >= 3 && !STOP.has(key) && /^\p{L}+$/u.test(w)) {
          const family = families.get(key) ?? { word: w, names: new Map<string, string>() }
          // Підпис — з великої літери, якщо хоч раз так написано
          if (/^\p{Lu}/u.test(w)) family.word = w
          if (!family.names.has(cultivarKey)) family.names.set(cultivarKey, cultivar)
          families.set(key, family)
        }
        const color = COLORS.find((c) => c.words.includes(key))
        if (color) colorBases.set(color.id, (colorBases.get(color.id) ?? new Set()).add(base))
        if (ROYAL.includes(key)) royals.add(base)
      }
    }
    const nameFamilies = [...families.values()]
      .filter((f) => f.names.size >= 2)
      .map((f) => ({ word: f.word, names: [...f.names.values()].sort((a, b) => a.localeCompare(b)) }))
      .sort((a, b) => b.names.length - a.names.length || a.word.localeCompare(b.word))
    const colors = COLORS.map((c) => ({ ...c, count: colorBases.get(c.id)?.size ?? 0 }))
      .filter((c) => c.count > 0)
      .sort((a, b) => b.count - a.count)

    // Батьки: скільки нащадків у кожної рослини. Хто з батьків мама, а хто тато, часто невідомо — тож не розрізняємо.
    // Ту саму рослину могли записати по-різному («Graptoveria 'Debbie'» і «graptoveria Debbie»), тож групуємо за
    // nameKey, а показуємо назву, як вона є в магазині (або як її найчастіше записували).
    const productByKey = new Map(products.filter((p) => p.category === PLANT_CATEGORY).map((p) => [nameKey(p.name.uk), p.name.uk.trim()]))
    const children = new Map<string, Set<string>>()
    const spellings = new Map<string, Map<string, number>>()
    let crossGenus = 0
    for (const p of plants) {
      const named = (p.parents ?? []).map((x) => x.trim()).filter(Boolean)
      for (const parent of named) {
        const key = nameKey(parent)
        // Нащадок — без форм: «Lola» і «Lola variegata» з тими самими батьками — один нащадок
        children.set(key, (children.get(key) ?? new Set()).add(baseKey(p.name.uk)))
        const sp = spellings.get(key) ?? new Map<string, number>()
        spellings.set(key, sp)
        count(sp, parent)
      }
      // Міжродовий гібрид: батьки з різних родів (напр. Graptopetalum × Echeveria)
      if (named.length === 2 && genusOf(named[0]) !== genusOf(named[1])) crossGenus++
    }
    const displayName = (key: string) => productByKey.get(key) ?? top(spellings.get(key) ?? new Map(), 1)[0]?.[0] ?? key
    const parents = [...children]
      .map(([key, kids]) => ({ name: displayName(key), kids: kids.size }))
      .sort((a, b) => b.kids - a.kids || a.name.localeCompare(b.name))
      .slice(0, 8)
    // Батьки, яких немає серед рослин магазину, але дуже схожа назва є — найімовірніше, описка («Debbi» → «Debbie»)
    const productKeys = [...productByKey.keys()]
    const typos = [...children.keys()]
      .filter((key) => !productByKey.has(key))
      .map((key) => {
        let best: { key: string; dist: number } | null = null
        for (const pk of productKeys) {
          // Лише той самий рід і не надто короткі назви — так, як і на сторінці товару (RelatedPlants)
          if (pk.split(' ')[0] !== key.split(' ')[0] || pk.length < 6) continue
          const dist = editDistance(key, pk)
          if (dist <= 2 && (!best || dist < best.dist)) best = { key: pk, dist }
        }
        return best && { written: [...(spellings.get(key)?.keys() ?? [])], suggestion: productByKey.get(best.key)!, kids: children.get(key)!.size }
      })
      .filter((x): x is { written: string[]; suggestion: string; kids: number } => !!x)
      .sort((a, b) => b.kids - a.kids)
    // Одна рослина записана серед батьків кількома способами (лапки, регістр) — сайт це вже зводить, але варто знати
    const variants = [...spellings.values()].filter((sp) => sp.size > 1).map((sp) => [...sp.keys()])

    const breeders = new Map<string, number>()
    plants.forEach((p) => p.breeder?.trim() && count(breeders, p.breeder.trim()))
    const habitats = new Map<string, number>()
    plants.forEach((p) => p.habitat?.trim() && count(habitats, p.habitat.trim()))

    // Один сорт у кількох формах: «Lola» і «Lola variegata»
    const formsOfBase = new Map<string, Set<string>>()
    for (const p of plants) {
      const key = d(p).base
      const formKey = STATE_TAGS.filter((s) => p.tags?.includes(s)).join('+') || 'plain'
      formsOfBase.set(key, (formsOfBase.get(key) ?? new Set()).add(formKey))
    }
    const multiForm = [...formsOfBase].filter(([, set]) => set.size >= 2).sort((a, b) => b[1].size - a[1].size)

    // Однакові назви (кілька товарів з тією самою назвою)
    const sameName = new Map<string, number>()
    plants.forEach((p) => count(sameName, p.name.uk.trim()))
    const duplicates = [...sameName].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1])

    const priced = plants.filter((p) => p.price > 0)
    const byPrice = [...priced].sort((a, b) => b.price - a.price)
    const byLength = [...plants].sort((a, b) => d(b).cultivar.length - d(a).cultivar.length)
    const named = byLength.filter((p) => d(p).cultivar.length > 0)
    // Куди веде назва рослини: її сторінка в магазині (точна назва, або та сама рослина в іншому написанні/формі),
    // а якщо такої рослини в магазині немає (напр. вид-батько) — пошук за назвою
    const slugByKey = new Map<string, string>()
    const slugByBase = new Map<string, string>()
    for (const p of [...products].filter((x) => x.category === PLANT_CATEGORY).sort((x, y) => Number(y.isActive) - Number(x.isActive))) {
      const k = nameKey(p.name.uk)
      if (!slugByKey.has(k)) slugByKey.set(k, p.slug)
      const b = baseKey(p.name.uk)
      // Для «бази» беремо звичайну форму, якщо вона є (у неї ключ без форм збігається з повним)
      if (!slugByBase.has(b) || k === b) slugByBase.set(b, p.slug)
    }
    // base: назва без форм (напр. «королівські» сорти) — тоді підходить і рослина в будь-якій формі.
    // Для батьків — лише точна назва: батько «lilacina» не має вести на «lilacina monstrose».
    const hrefFor = (name: string, base = false) => {
      const slug = slugByKey.get(nameKey(name)) ?? (base ? slugByBase.get(baseKey(name)) : undefined)
      return slug ? `/product/${slug}` : `/search?q=${encodeURIComponent(name)}`
    }
    const stockUnits = plants.reduce((s, p) => s + p.stock, 0)
    const stockValue = plants.reduce((s, p) => s + p.stock * p.price, 0)

    return {
      total: plants.length,
      shown: plants.filter((p) => p.isActive).length,
      inStock: plants.filter((p) => p.isActive && p.stock > 0).length,
      distinct: formsOfBase.size,
      forms,
      plain: plainCount,
      doubleForm,
      cuttings,
      origins,
      genera: top(genera, 10),
      generaCount: genera.size,
      nameFamilies,
      colors,
      royals: [...royals].sort(),
      parents,
      typos,
      variants,
      crossGenus,
      breeders: top(breeders, 6),
      habitats: top(habitats, 6),
      multiForm,
      duplicates,
      priciest: byPrice[0],
      cheapest: byPrice.at(-1),
      avgPrice: priced.length ? Math.round(priced.reduce((s, p) => s + p.price, 0) / priced.length / 100) * 100 : 0,
      longest: named[0],
      shortest: named.at(-1),
      noPhoto: plants.filter((p) => p.images.length === 0).length,
      noOrigin: plants.filter((p) => !originOf(p)).length,
      stockUnits,
      stockValue,
      name: (p: Product) => d(p).base,
      hrefFor,
    }
  }, [products, scope])

  if (isLoading) return <p className="text-sand-700">{t('loading')}</p>
  if (isError) return <p className="text-red-700">{t('errors.loading')}</p>

  const pct = (n: number) => (stats ? Math.round((n / stats.total) * 100) : 0)
  const plantsWord = (n: number) => t('plantStats.plants', { count: n })
  // Назва рослини — посилання на її сторінку (або на пошук, якщо такої рослини в магазині немає)
  const plant = (name: string, href?: string) =>
    stats ? (
      <Link key={name} to={href ?? stats.hrefFor(name)} className="underline decoration-current/30 underline-offset-2 hover:text-brand-600 hover:decoration-brand-600">
        {name}
      </Link>
    ) : (
      name
    )
  // Текст перекладу з назвою всередині («Найдовша назва — X»): назву робимо посиланням
  const MARK = '\u0001'
  const linked = (text: string, name: string, href?: string) => {
    const [before, after = ''] = text.split(MARK)
    return (
      <>
        {before}
        {plant(name, href)}
        {after}
      </>
    )
  }
  const list = (names: string[], base = false) =>
    names.flatMap((n, i) => { const el = plant(n, stats?.hrefFor(n, base)); return i ? [', ', el] : [el] })
  // Посилання прямо на сторінку конкретного товару
  const own = (p: Product) => `/product/${p.slug}`

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-sand-700">{t('plantStats.intro')}</p>
        <div className="flex rounded-2xl bg-sand-200 p-1" role="radiogroup" aria-label={t('plantStats.scope')}>
          {SCOPES.map((s) => (
            <button
              key={s}
              role="radio"
              aria-checked={scope === s}
              onClick={() => setScope(s)}
              className={`min-h-10 rounded-xl px-3 text-sm font-bold whitespace-nowrap transition-colors sm:px-4 ${
                scope === s ? 'bg-sand-50 text-ink shadow-sm' : 'text-sand-700 hover:text-ink'
              }`}
            >
              {t(`plantStats.scopes.${s}`)}
            </button>
          ))}
        </div>
      </div>

      {!stats ? (
        <p className="rounded-3xl border-2 border-dashed border-sand-300 py-12 text-center text-sand-700">{t('plantStats.empty')}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile
              icon={Sprout}
              label={t('plantStats.total')}
              value={String(stats.total)}
              hint={t('plantStats.totalHint', { shown: stats.shown, inStock: stats.inStock })}
              accent
            />
            <Tile icon={Leaf} label={t('plantStats.distinct')} value={String(stats.distinct)} hint={t('plantStats.distinctHint')} />
            <Tile icon={Layers} label={t('plantStats.genera')} value={String(stats.generaCount)} />
            <Tile
              icon={Warehouse}
              label={t('plantStats.stock')}
              value={t('analytics.pcs', { count: stats.stockUnits })}
              hint={t('plantStats.stockHint', { amount: formatPrice(stats.stockValue, lang) })}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
            {/* Форми: варієгата, кристата, монстроза, звичайні */}
            <Card title={t('plantStats.forms')} icon={Sparkles}>
              <RankList
                max={stats.total}
                rows={[
                  ...STATE_TAGS.map((s) => ({
                    key: s,
                    label: (
                      <span className="inline-flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${TAG_DOTS[s]}`} aria-hidden />
                        {t(`tags.${s}`)}
                      </span>
                    ),
                    value: stats.forms.get(s) ?? 0,
                    text: `${stats.forms.get(s) ?? 0} · ${pct(stats.forms.get(s) ?? 0)}%`,
                  })),
                  { key: 'plain', label: t('plantStats.plain'), value: stats.plain, text: `${stats.plain} · ${pct(stats.plain)}%` },
                ]}
              />
              {(stats.doubleForm > 0 || stats.cuttings > 0) && (
                <p className="mt-3 text-xs text-sand-700">
                  {[
                    stats.doubleForm > 0 && t('plantStats.doubleForm', { count: stats.doubleForm }),
                    stats.cuttings > 0 && t('plantStats.cuttings', { count: stats.cuttings }),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              )}
            </Card>

            {/* Походження: природні види, гібриди, відбори */}
            <Card title={t('plantStats.origins')} icon={Dna}>
              <RankList
                max={stats.total}
                rows={(['natural', 'hybrid', 'cultivar', 'unknown'] as const).map((o) => ({
                  key: o,
                  label: t(`plantStats.originNames.${o}`),
                  value: stats.origins.get(o) ?? 0,
                  text: `${stats.origins.get(o) ?? 0} · ${pct(stats.origins.get(o) ?? 0)}%`,
                }))}
              />
              {stats.crossGenus > 0 && <p className="mt-3 text-xs text-sand-700">{t('plantStats.crossGenus', { count: stats.crossGenus })}</p>}
              {stats.multiForm.length > 0 && (
                <Link to="/admin/forms" className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-brand-600 underline">
                  <Sparkles size={16} strokeWidth={2.25} aria-hidden />
                  {t('admin.formFixes.link')}
                </Link>
              )}
            </Card>

            <Card title={t('plantStats.topGenera')} icon={Layers}>
              <RankList
                rows={stats.genera.map(([g, n]) => ({ key: g, label: <span className="italic">{g}</span>, value: n, text: `${n} · ${pct(n)}%` }))}
              />
            </Card>

            {/* Кольори в назвах */}
            {stats.colors.length > 0 && (
              <Card title={t('plantStats.colors')} icon={Palette}>
                <ul className="grid grid-cols-2 gap-2">
                  {stats.colors.map((c) => (
                    <li key={c.id} className="flex items-center gap-2.5 rounded-2xl bg-sand-100 p-2.5">
                      <span className="h-7 w-7 shrink-0 rounded-full border-2 border-sand-50 shadow-sm" style={{ background: c.swatch }} aria-hidden />
                      <span className="min-w-0 flex-1 text-sm font-bold">{t(`plantStats.colorNames.${c.id}`)}</span>
                      <span className="font-display font-extrabold text-brand-600 tabular-nums">{c.count}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-sand-700">{t('plantStats.colorsHint')}</p>
              </Card>
            )}
          </div>

          {/* Родини назв: Prince — Black Prince, Red Prince… */}
          {stats.nameFamilies.length > 0 && (
            <Card title={t('plantStats.families')} icon={Tag}>
              <p className="-mt-2 mb-3 text-sm text-sand-700">{t('plantStats.familiesHint')}</p>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {(allFamilies ? stats.nameFamilies : stats.nameFamilies.slice(0, FAMILIES)).map((f) => (
                  <li key={f.word} className="rounded-2xl border-2 border-sand-200 p-3">
                    <p className="flex items-baseline justify-between gap-2">
                      <span className="font-display text-lg font-extrabold text-brand-600">{f.word}</span>
                      <span className="text-sm font-bold text-sunset-600 tabular-nums">×{f.names.length}</span>
                    </p>
                    <p className="mt-1 text-sm text-sand-700">
                      {list(f.names.slice(0, 5))}
                      {f.names.length > 5 && ` ${t('plantStats.andMore', { count: f.names.length - 5 })}`}
                    </p>
                  </li>
                ))}
              </ul>
              {stats.nameFamilies.length > FAMILIES && (
                <button
                  type="button"
                  onClick={() => setAllFamilies(!allFamilies)}
                  className="mt-3 min-h-11 rounded-xl bg-sand-200 px-4 text-sm font-bold hover:bg-sand-300"
                >
                  {allFamilies ? t('plantStats.showLess') : t('plantStats.showAll', { count: stats.nameFamilies.length })}
                </button>
              )}
            </Card>
          )}

          <div className="grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
            {/* У кого найбільше нащадків */}
            {stats.parents.length > 0 && (
              <Card title={t('plantStats.parents')} icon={Baby}>
                <RankList
                  rows={stats.parents.map((p) => ({
                    key: p.name,
                    label: <span className="italic">{plant(p.name)}</span>,
                    value: p.kids,
                    text: t('plantStats.kids', { count: p.kids }),
                  }))}
                />
                <p className="mt-3 text-xs text-sand-700">{t('plantStats.parentsHint')}</p>
              </Card>
            )}
            <div className="space-y-6">
              {stats.breeders.length > 0 && (
                <Card title={t('plantStats.breeders')} icon={UserRound}>
                  <RankList rows={stats.breeders.map(([b, n]) => ({ key: b, label: b, value: n, text: plantsWord(n) }))} />
                </Card>
              )}
              {stats.habitats.length > 0 && (
                <Card title={t('plantStats.habitats')} icon={Globe2}>
                  <RankList rows={stats.habitats.map(([h, n]) => ({ key: h, label: h, value: n, text: plantsWord(n) }))} />
                </Card>
              )}
            </div>
          </div>

          {/* Перевірка назв батьків: схожа, але не така сама назва, як у рослини магазину, — найімовірніше описка.
              Через таку описку батько й дитина не «бачать» одне одного (на сторінці товару, в аналітиці). */}
          {(stats.typos.length > 0 || stats.variants.length > 0) && (
            <Card title={t('plantStats.typos')} icon={SpellCheck}>
              <p className="-mt-2 mb-3 text-sm text-sand-700">{t('plantStats.typosHint')}</p>
              {stats.typos.length > 0 && (
                <ul className="space-y-2">
                  {stats.typos.map((x) => (
                    <li key={x.written.join('|')} className="rounded-2xl border-2 border-sunset-500/40 bg-sunset-100/40 p-3 text-sm">
                      <span className="font-bold text-red-700 line-through decoration-red-700/50">{x.written.join(' / ')}</span>
                      {' → '}
                      <span className="font-bold text-brand-700">{plant(x.suggestion)}</span>
                      <span className="text-sand-700"> · {t('plantStats.kids', { count: x.kids })}</span>
                      <Link to={`/search?q=${encodeURIComponent(x.written[0])}`} className="ml-2 font-bold text-brand-600 underline">
                        {t('plantStats.typosFind')}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {/* Усі рослини, які серед батьків записані по-різному: кожне написання окремо, з пошуком товарів за ним */}
              {stats.variants.length > 0 && (
                <div className={stats.typos.length > 0 ? 'mt-4' : ''}>
                  <p className="mb-2 text-sm text-sand-700">{t('plantStats.variants', { count: stats.variants.length })}</p>
                  <ul className="space-y-2">
                    {stats.variants.map((v) => (
                      <li key={v.join('|')} className="flex flex-wrap items-center gap-1.5 rounded-2xl border-2 border-sand-200 p-3 text-sm">
                        {v.map((written, i) => (
                          <span key={written} className="inline-flex items-center gap-1.5">
                            {i > 0 && <span className="text-sand-700">=</span>}
                            <Link
                              to={`/search?q=${encodeURIComponent(written)}`}
                              className="rounded-lg bg-sand-100 px-2 py-1 font-bold hover:bg-brand-600 hover:text-sand-50"
                              title={t('plantStats.typosFind')}
                            >
                              {written}
                            </Link>
                          </span>
                        ))}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          )}

          {/* Цікаві факти */}
          <section>
            <h2 className="mb-3 flex items-center gap-2 font-display text-xl font-extrabold text-brand-600">
              <Sparkles size={20} strokeWidth={2.25} aria-hidden />
              {t('analytics.facts')}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {stats.parents[0] && (
                <Fact icon={Baby} title={linked(t('plantStats.factParent', { name: MARK }), stats.parents[0].name)}>
                  {t('plantStats.factParentText', { count: stats.parents[0].kids })}
                </Fact>
              )}
              {stats.forms.get('variegata') ? (
                <Fact icon={Sparkles} title={t('plantStats.factVariegata', { percent: pct(stats.forms.get('variegata') ?? 0) })}>
                  {t('plantStats.factVariegataText', { count: stats.forms.get('variegata') })}
                </Fact>
              ) : null}
              {stats.royals.length > 0 && (
                <Fact icon={Crown} title={t('plantStats.factRoyal', { count: stats.royals.length })}>
                  {list(stats.royals.slice(0, 5), true)}
                </Fact>
              )}
              {stats.priciest && (
                <Fact icon={Gem} title={t('plantStats.factPriciest', { amount: formatPrice(stats.priciest.price, lang) })}>
                  {plant(stats.name(stats.priciest), own(stats.priciest))}
                  {stats.cheapest && stats.cheapest !== stats.priciest &&
                    <> · {linked(t('plantStats.factCheapest', { name: MARK, amount: formatPrice(stats.cheapest.price, lang) }), stats.name(stats.cheapest), own(stats.cheapest))}</>}
                </Fact>
              )}
              {stats.avgPrice > 0 && (
                <Fact icon={Banknote} title={t('plantStats.factAvg', { amount: formatPrice(stats.avgPrice, lang) })}>
                  {t('plantStats.factAvgText')}
                </Fact>
              )}
              {stats.multiForm.length > 0 && (
                <Fact icon={Layers} title={t('plantStats.factMultiForm', { count: stats.multiForm.length })}>
                  {linked(t('plantStats.factMultiFormText', { name: MARK, count: stats.multiForm[0][1].size }), stats.multiForm[0][0], stats.hrefFor(stats.multiForm[0][0], true))}
                </Fact>
              )}
              {stats.longest && stats.shortest && stats.longest !== stats.shortest && (
                <Fact icon={Ruler} title={linked(t('plantStats.factLongest', { name: MARK }), stats.name(stats.longest), own(stats.longest))}>
                  {linked(t('plantStats.factShortest', { name: MARK }), stats.name(stats.shortest), own(stats.shortest))}
                </Fact>
              )}
              {stats.duplicates.length > 0 && (
                <Fact icon={Copy} title={t('plantStats.factDuplicates', { count: stats.duplicates.length })}>
                  {linked(t('plantStats.factDuplicatesText', { name: MARK, count: stats.duplicates[0][1] }), stats.duplicates[0][0])}
                </Fact>
              )}
              {stats.noPhoto > 0 && (
                <Fact icon={Camera} title={t('plantStats.factNoPhoto', { count: stats.noPhoto })}>
                  {t('plantStats.factNoPhotoText', { percent: pct(stats.noPhoto) })}
                </Fact>
              )}
              {stats.noOrigin > 0 && (
                <Fact icon={Dna} title={t('plantStats.factNoOrigin', { count: stats.noOrigin })}>
                  {t('plantStats.factNoOriginText')}
                </Fact>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
