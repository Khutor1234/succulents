import { GitFork, Leaf, MapPin, Sprout, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import type { PlantOrigin } from '../../lib/types'

/** Ім'я рослини чи країни — «чип», що веде в пошук (одразу видно, чи є в магазині сам батько або його інші «діти»). */
function Chip({ to, title, big, grow, icon, children }: { to: string; title: string; big?: boolean; grow?: boolean; icon?: React.ReactNode; children: string }) {
  return (
    <Link
      to={`/search?q=${encodeURIComponent(to)}`}
      title={title}
      className={`inline-flex max-w-full items-center gap-1 border border-brand-500/25 ${big ? 'rounded-2xl' : 'rounded-lg'} bg-brand-100/70 font-semibold text-brand-700 transition-colors hover:border-brand-600 hover:bg-brand-600 hover:text-sand-50 ${
        big ? 'justify-center px-3.5 py-1.5 text-center text-sm leading-snug' : 'min-w-0 px-1.5 py-0.5 text-[11px] leading-tight'
      } ${grow ? 'flex-1 basis-0 justify-center text-center' : ''}`}
    >
      {icon}
      {/* На картці довга назва переноситься щонайбільше на два рядки */}
      <span className={big ? 'break-words' : 'line-clamp-2 break-words'}>{children}</span>
    </Link>
  )
}

/** Невеликий підпис над чипами: іконка + «Гібрид» / «Природний вид» / «Відбір або мутація». */
function Kicker({ icon, children, big }: { icon: React.ReactNode; children: string; big?: boolean }) {
  return (
    <p className={`flex items-center gap-1.5 font-bold tracking-wider text-sand-700 uppercase ${big ? 'text-xs' : 'text-[10px]'}`}>
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
  label = false,
  className = '',
}: {
  parents?: string[]
  origin?: PlantOrigin
  habitat?: string
  breeder?: string
  label?: boolean
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
    <span aria-label="×" className="shrink-0 font-display text-2xl font-extrabold text-sunset-600">×</span>
  ) : (
    <span aria-label="×" className="flex h-5 w-5 shrink-0 items-center justify-center self-center rounded-full bg-sunset-100 font-display text-xs font-extrabold text-sunset-600">×</span>
  )
  const unknown = (
    <span
      className={`border border-dashed border-sand-300 italic text-sand-700 ${
        big ? 'shrink-0 rounded-full px-3.5 py-1.5 text-sm whitespace-nowrap' : 'flex flex-1 basis-0 items-center justify-center rounded-lg px-1.5 py-0.5 text-[11px]'
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
            <Chip to={habitat} title={find(habitat)} icon={<MapPin size={11} strokeWidth={2.5} aria-hidden />}>
              {habitat}
            </Chip>
          )}
          {cultivar && names[0] && (
            <>
              <span className="shrink-0 self-center text-xs text-sand-700">{t('search.from')}</span>
              <Chip to={names[0]} title={find(names[0])}>{names[0]}</Chip>
            </>
          )}
          {!natural && !cultivar && (
            <>
              {/* Дві назви ділять рядок порівну */}
              <Chip to={names[0]} title={find(names[0])} grow>{names[0]}</Chip>
              {cross}
              {names[1] ? <Chip to={names[1]} title={find(names[1])} grow>{names[1]}</Chip> : unknown}
            </>
          )}
        </div>
      </div>
    )
  }

  // Детальна картка на сторінці товару
  // Плитка одного з батьків — без підписів «материнська/батьківська»: часто це невідомо
  const parentTile = (name?: string) => (
    <div className="flex min-w-0 flex-1 items-center justify-center rounded-2xl bg-sand-100 px-2 py-3 text-center">
      {name ? <Chip to={name} title={find(name)} big>{name}</Chip> : unknown}
    </div>
  )

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
          <Chip to={names[0]} title={find(names[0])} big>{names[0]}</Chip>
        </div>
      )}
      {!natural && !cultivar && names.length > 0 && (
        <div className="mt-3 flex items-center gap-2">
          {parentTile(names[0])}
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
