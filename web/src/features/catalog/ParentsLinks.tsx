import { GitFork, Leaf, MapPin, Plus, Sprout, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useAuth } from '../auth/authStore'
import { useProductByName } from './api'
import { PLANT_CATEGORY } from '../../lib/plants'
import type { PlantOrigin, Product } from '../../lib/types'
import { useHere } from '../../shared/navigation'

// Плашка з назвою: на сторінці товару — однакова для батьків, «Від …», ареалу й селекціонера.
// Є в магазині — зелена й клікабельна; немає — пунктирна, без посилання.
const pillBase = (big?: boolean) =>
  `inline-flex max-w-full items-center justify-center border text-center font-semibold ${
    big ? 'min-h-11 gap-1.5 rounded-2xl px-3.5 py-2 text-sm leading-snug' : 'min-w-0 gap-1 rounded-lg px-1.5 py-0.5 text-[11px] leading-tight'
  }`
const PILL_LINK = 'border-brand-500/25 bg-brand-100/70 text-brand-700 transition-colors hover:border-brand-600 hover:bg-brand-600 hover:text-sand-50'
const PILL_MISSING = 'border-dashed border-sand-300 bg-sand-100/60 text-sand-700'

/**
 * Ім'я рослини чи країни — «чип», що веде в пошук (одразу видно, чи є в магазині сам батько або його інші «діти»).
 * `href` — веде прямо на цю адресу (сторінку рослини). `plain` — просто назва без посилання (такої рослини в магазині немає).
 */
function Chip({
  to,
  href,
  title,
  big,
  grow,
  full,
  plain,
  icon,
  children,
}: {
  to: string
  href?: string
  title: string
  big?: boolean
  grow?: boolean
  full?: boolean
  plain?: boolean
  icon?: React.ReactNode
  children: string
}) {
  const className = `${pillBase(big)} ${plain ? PILL_MISSING : PILL_LINK} ${grow ? 'flex-1 basis-0' : ''}`
  // На картці довга назва переноситься щонайбільше на два рядки; `full` — повністю, скільки б рядків не зайняла
  const label = <span className={big || full ? 'break-words' : 'line-clamp-2 break-words'}>{children}</span>
  if (plain)
    return (
      <span title={title} className={className}>
        {icon}
        {label}
      </span>
    )
  return (
    <Link to={href ?? `/search?q=${encodeURIComponent(to)}`} title={title} className={className}>
      {icon}
      {label}
    </Link>
  )
}

/**
 * Рослина за назвою: є в магазині — веде на її сторінку; немає — просто назва без посилання
 * (поки перевіряємо — теж без посилання, щоб не мигнуло клікабельним).
 */
function PlantChip({ name, big, full, grow, known }: { name: string; big?: boolean; full?: boolean; grow?: boolean; known?: Product['base'] }) {
  const { t } = useTranslation()
  const isSeller = useAuth((s) => s.role === 'seller')
  const { data: plant } = useProductByName(name, isSeller)
  const title = plant ? t('search.openPlant', { name }) : t('search.notInShop', { name })
  const chip = (
    <Chip to={name} href={plant ? `/product/${plant.slug}` : undefined} title={title} big={big} full={full} grow={grow} plain={!plant}>
      {name}
    </Chip>
  )
  // Продавцю на сторінці товару: такої рослини ще немає — сама пунктирна плашка з плюсиком відкриває нову картку
  // з назвою й тим, що про неї відомо
  if (!(big && isSeller && plant === null)) return chip
  return <AddPlantLink name={name} known={known} grow={grow} />
}

function AddPlantLink({ name, known, grow }: { name: string; known?: Product['base']; grow?: boolean }) {
  const { t } = useTranslation()
  const here = useHere()
  const params = new URLSearchParams({ category: PLANT_CATEGORY, name })
  if (known) {
    params.set('origin', known.origin)
    known.parents.forEach((p, i) => p && params.set(`p${i + 1}`, p))
    if (known.habitat) params.set('habitat', known.habitat)
  }
  const label = t('search.addPlant', { name })
  return (
    <Link
      to={`/admin/products/new?${params}`}
      state={{ from: here }}
      title={label}
      aria-label={label}
      className={`group/add ${pillBase(true)} ${PILL_MISSING} transition-colors hover:border-solid hover:border-brand-600 hover:text-brand-700 ${grow ? 'flex-1 basis-0' : ''}`}
    >
      <span className="break-words">{name}</span>
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sand-50 transition-transform group-hover/add:scale-110">
        <Plus size={13} strokeWidth={3} aria-hidden />
      </span>
    </Link>
  )
}

/** «Мутація від …»: веде на сторінку цієї рослини, а якщо її в магазині немає — просто назва. */
const SourceChip = PlantChip

/**
 * Походження звичайної версії для форми (variegata, cristata…, «hybrid»): «Echeveria Lola variegata» від «Echeveria Lola»,
 * а та — Echeveria lilacina × Echeveria derenbergii (або природний вид, або відбір від іншої рослини).
 * Вписане продавцем у формі цієї рослини (`base`), інакше — з картки звичайної версії, якщо вона є в магазині.
 */
function SourceParents({ name, base, tile, cross }: { name: string; base?: Product['base']; tile: (name?: string) => React.ReactNode; cross: React.ReactNode }) {
  const { t } = useTranslation()
  const isSeller = useAuth((s) => s.role === 'seller')
  const { data: source } = useProductByName(name, isSeller)
  const info = base ?? (source ? { origin: source.origin ?? 'hybrid', parents: source.parents ?? [], habitat: source.habitat } : null)
  if (!info) return null
  const parents = info.parents.filter(Boolean)
  // Природний вид: батьків немає, тож показуємо, звідки він
  if (info.origin === 'natural')
    return (
      <p className="mt-3 flex flex-wrap items-center gap-2 border-t border-sand-200 pt-3 text-sm text-sand-700">
        <Leaf size={14} strokeWidth={2.5} className="shrink-0" aria-hidden />
        <span>{t('search.sourceNatural', { name })}</span>
        {info.habitat && (
          <Chip to={info.habitat} title={t('search.findParent', { name: info.habitat })} big icon={<MapPin size={14} strokeWidth={2.5} aria-hidden />}>
            {info.habitat}
          </Chip>
        )}
      </p>
    )
  if (parents.length === 0) return null
  if (info.origin === 'cultivar')
    return (
      <p className="mt-3 flex flex-wrap items-center gap-2 border-t border-sand-200 pt-3 text-sm text-sand-700">
        <Sparkles size={14} strokeWidth={2.5} className="shrink-0" aria-hidden />
        <span>{t('search.sourceCultivar', { name })}</span>
        <PlantChip name={parents[0]} big />
      </p>
    )
  return (
    <div className="mt-3 border-t border-sand-200 pt-3">
      <p className="text-sm text-sand-700">{t('search.sourceParents', { name })}</p>
      <div className="mt-2 flex items-stretch gap-2">
        {tile(parents[0])}
        {cross}
        {tile(parents[1])}
      </div>
    </div>
  )
}

/** Невеликий підпис над чипами: іконка + «Гібрид» / «Природний вид» / «Відбір або мутація». */
function Kicker({ icon, children, big }: { icon: React.ReactNode; children: string; big?: boolean }) {
  return (
    <p className={`flex items-center gap-1.5 font-bold text-sand-700 ${big ? 'text-sm' : 'text-[11px]'}`}>
      {icon}
      {children}
    </p>
  )
}

/**
 * Походження рослини.
 * - На картці (компактно): підпис типу і чипи — «Lola × Romeo», «від lilacina» або «Мексика».
 * - На сторінці товару (`label`): окрема картка «Походження» — для гібрида дві плитки з батьками через ×,
 *   для природного виду — ареал, плюс селекціонер, якщо відомий.
 */
export function ParentsLinks({
  parents,
  origin = 'hybrid',
  habitat,
  breeder,
  base,
  label = false,
  fullNames = false,
  className = '',
}: {
  parents?: string[]
  origin?: PlantOrigin
  habitat?: string
  breeder?: string
  /** Походження звичайної версії — лише для форм (variegata…) і «hybrid»; undefined — рослина не форма. */
  base?: Product['base']
  label?: boolean
  /** На картці не обрізати довгі назви батьків (напр., у дрібних картках «Пов’язані рослини»). */
  fullNames?: boolean
  className?: string
}) {
  const { t } = useTranslation()
  const names = (parents ?? []).filter(Boolean)
  const big = label
  const iconSize = big ? 14 : 11
  const find = (name: string) => t('search.findParent', { name })

  const natural = origin === 'natural'
  const cultivar = origin === 'cultivar'
  if (!natural && names.length === 0 && !(big && breeder)) return null

  const kicker = natural ? (
    <Kicker big={big} icon={<Leaf size={iconSize} strokeWidth={2.5} aria-hidden />}>
      {t('search.natural')}
    </Kicker>
  ) : cultivar ? (
    <Kicker big={big} icon={<Sparkles size={iconSize} strokeWidth={2.5} aria-hidden />}>
      {t('search.cultivar')}
    </Kicker>
  ) : (
    <Kicker big={big} icon={<GitFork size={iconSize} strokeWidth={2.5} className="rotate-180" aria-hidden />}>
      {t('search.hybrid')}
    </Kicker>
  )

  const cross = big ? (
    <span aria-label="×" className="shrink-0 self-center font-display text-2xl font-extrabold text-sunset-600">×</span>
  ) : (
    <span aria-label="×" className="flex h-5 w-5 shrink-0 items-center justify-center self-center rounded-full bg-sunset-100 font-display text-xs font-extrabold text-sunset-600">×</span>
  )
  const unknown = (
    <span
      className={`border border-dashed border-sand-300 italic text-sand-700 ${
        big ? 'flex min-h-11 flex-1 basis-0 items-center justify-center rounded-2xl bg-sand-100/60 px-3.5 py-2 text-sm' : 'flex flex-1 basis-0 items-center justify-center rounded-lg px-1.5 py-0.5 text-[11px]'
      }`}
    >
      {t('search.unknownParent')}
    </span>
  )

  // Компактний вигляд на картці — один тонкий рядок: значок типу + чипи.
  // Обидва батьки завжди в одному рядку; кожна назва повністю, а якщо довга — у два рядки.
  if (!big) {
    const kind = t(natural ? 'search.natural' : cultivar ? 'search.cultivar' : 'search.hybrid')
    const Icon = natural ? Leaf : cultivar ? Sparkles : GitFork
    return (
      <div className={`flex min-w-0 items-center gap-1 ${className}`}>
        {/* Для гібрида значок не потрібен — «×» між батьками і так це показує, а місце назвам потрібніше */}
        <span title={kind} className={natural || cultivar ? 'flex shrink-0 items-center gap-1 text-sand-700' : 'sr-only'}>
          <Icon size={13} strokeWidth={2.5} className={natural || cultivar ? '' : 'rotate-180'} aria-hidden />
          {/* Для природного виду слово видно (поруч лише країна), для гібрида — лише для екранних читалок */}
          <span className={natural ? 'text-xs font-semibold' : 'sr-only'}>{kind}</span>
        </span>
        {/* На всю ширину плашки; чипи однакової висоти, навіть якщо одна назва у два рядки */}
        <div className="flex min-w-0 flex-1 items-stretch gap-1.5">
          {natural && habitat && (
            <Chip full={fullNames} to={habitat} title={find(habitat)} icon={<MapPin size={11} strokeWidth={2.5} aria-hidden />}>
              {habitat}
            </Chip>
          )}
          {cultivar && names[0] && (
            <>
              <span className="shrink-0 self-center text-xs text-sand-700">{t('search.from')}</span>
              <SourceChip full={fullNames} name={names[0]} />
            </>
          )}
          {!natural && !cultivar && (
            <>
              {/* Дві назви ділять рядок порівну */}
              <Chip full={fullNames} to={names[0]} title={find(names[0])} grow>{names[0]}</Chip>
              {cross}
              {names[1] ? <Chip full={fullNames} to={names[1]} title={find(names[1])} grow>{names[1]}</Chip> : unknown}
            </>
          )}
        </div>
      </div>
    )
  }

  // Детальна картка на сторінці товару
  // Плашка одного з батьків — без підписів «материнська/батьківська»: часто це невідомо. Дві плашки ділять рядок порівну.
  // known — що відомо про саму цю рослину (для плюсика продавця «створити картку»)
  const parentTile = (name?: string, known?: Product['base']) => (name ? <PlantChip name={name} big grow known={known} /> : unknown)

  return (
    <section aria-label={t('search.origin')} className={`rounded-3xl border-2 border-sand-200 bg-sand-50 p-4 ${className}`}>
      {kicker}
      {natural && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-sand-700">
          <span>{t('search.naturalHint')}</span>
          {habitat && (
            <Chip to={habitat} title={find(habitat)} big icon={<MapPin size={14} strokeWidth={2.5} aria-hidden />}>
              {habitat}
            </Chip>
          )}
        </div>
      )}
      {cultivar && names[0] && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-sand-700">
          <span>{t('search.cultivarHint')}</span>
          <SourceChip name={names[0]} big known={base ?? undefined} />
        </div>
      )}
      {/* Форма від звичайної версії (variegata…) чи «hybrid» від неї — ще й походження самої звичайної версії */}
      {(cultivar || (base !== undefined && !natural)) && names[0] && <SourceParents name={names[0]} base={base} tile={parentTile} cross={cross} />}
      {!natural && !cultivar && names.length > 0 && (
        <div className="mt-3 flex items-stretch gap-2">
          {/* «Echeveria Orion hybrid»: перший батько — сам Orion, і про нього може бути відоме походження (base) */}
          {parentTile(names[0], base ?? undefined)}
          {cross}
          {parentTile(names[1])}
        </div>
      )}
      {breeder && !natural && (
        <p className="mt-3 flex flex-wrap items-center gap-2 border-t border-sand-200 pt-3 text-sm text-sand-700">
          <Sprout size={16} strokeWidth={2.25} className="shrink-0" aria-hidden />
          <span className="font-bold">{t('search.breeder')}:</span>
          <Chip to={breeder} title={t('search.findBreeder', { name: breeder })} big>{breeder}</Chip>
        </p>
      )}
    </section>
  )
}
