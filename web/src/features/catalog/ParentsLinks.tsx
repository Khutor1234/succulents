import { GitFork, Leaf } from 'lucide-react'
import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import type { PlantOrigin } from '../../lib/types'

const LINK = 'font-medium text-brand-600 underline decoration-brand-500/40 underline-offset-2 hover:decoration-brand-600'

/**
 * Походження рослини, кожне ім'я — посилання в пошук (одразу видно, чи є в магазині сам батько або інші його «діти»):
 * - гібрид: «Батьки: Echeveria Lola × Echeveria Romeo»; якщо відомий лише один — «Echeveria Lola × невідомий»;
 * - сорт: «Сорт від: Echeveria lilacina»;
 * - з природи: «З природи · ареал: Мексика».
 */
export function ParentsLinks({
  parents,
  origin = 'hybrid',
  habitat,
  label = false,
  className = '',
}: {
  parents?: string[]
  origin?: PlantOrigin
  habitat?: string
  label?: boolean
  className?: string
}) {
  const { t } = useTranslation()
  const names = (parents ?? []).filter(Boolean)

  // Природна рослина: «З природи · ареал: Мексика» (країна — посилання в пошук: інші рослини звідти ж).
  if (origin === 'natural') {
    return (
      <p className={`flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sand-700 ${className}`}>
        <Leaf size={label ? 16 : 13} strokeWidth={2.25} className="shrink-0" aria-hidden />
        <span className={label ? 'font-bold' : ''}>{t('search.natural')}</span>
        {habitat && (
          <>
            <span aria-hidden>·</span>
            <span>{t('search.habitat')}:</span>
            <Link to={`/search?q=${encodeURIComponent(habitat)}`} title={t('search.findParent', { name: habitat })} className={LINK}>
              {habitat}
            </Link>
          </>
        )}
      </p>
    )
  }

  if (names.length === 0) return null

  const cultivar = origin === 'cultivar'
  const title = t(cultivar ? 'search.cultivarOf' : 'search.parents')
  const link = (name: string) => (
    <Link to={`/search?q=${encodeURIComponent(name)}`} title={t('search.findParent', { name })} className={LINK}>
      {name}
    </Link>
  )

  return (
    <p className={`flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sand-700 ${className}`}>
      <GitFork size={label ? 16 : 13} strokeWidth={2.25} className="shrink-0 rotate-180" aria-hidden />
      {label ? <span className="font-bold">{title}:</span> : <span className={cultivar ? '' : 'sr-only'}>{cultivar ? `${title}` : `${title}:`}</span>}
      {cultivar ? (
        link(names[0])
      ) : (
        <>
          {names.map((name, i) => (
            <Fragment key={name + i}>
              {i > 0 && <span aria-hidden>×</span>}
              {link(name)}
            </Fragment>
          ))}
          {/* Відомий лише один із батьків — другий позначаємо як невідомий */}
          {names.length === 1 && (
            <>
              <span aria-hidden>×</span>
              <span className="italic">{t('search.unknownParent')}</span>
            </>
          )}
        </>
      )}
    </p>
  )
}
