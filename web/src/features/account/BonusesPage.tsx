import { Gift, Minus, Plus, Wallet } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useLang } from '../../i18n'
import { formatPrice } from '../../lib/format'
import { ICON } from '../../shared/icon'
import { PageTitle } from '../../shared/ui'
import { BackToAccount, formatDate } from './AccountPage'
import { useBonusBalance, useBonusHistory, type BonusEntry } from './api'

/** Один рядок історії: кружечок (+ / − / подарунок), що це було, дата і сума. Спільний для кабінету й цієї сторінки. */
export function BonusRow({ entry }: { entry: BonusEntry }) {
  const { t } = useTranslation()
  const lang = useLang()
  const plus = entry.amount > 0
  const Icon = entry.type === 'welcome' ? Gift : plus ? Plus : Minus
  return (
    <li className="flex items-center gap-3 py-3">
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full sm:h-10 sm:w-10 ${
          plus ? 'bg-brand-100 text-brand-600' : 'bg-sunset-100 text-sunset-600'
        }`}
      >
        <Icon size={18} strokeWidth={2.5} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block leading-snug font-medium">{t(`account.entry.${entry.type}`, { number: entry.orderNumber })}</span>
        <span className="text-sm text-sand-700">{formatDate(entry)}</span>
      </span>
      <span className={`font-display text-lg font-extrabold whitespace-nowrap ${plus ? 'text-brand-600' : 'text-sunset-600'}`}>
        {plus ? '+' : '−'}
        {formatPrice(Math.abs(entry.amount), lang)}
      </span>
    </li>
  )
}

/** «Листопад 2026» — заголовок групи записів за місяць. */
function monthOf(entry: BonusEntry) {
  const label = entry.createdAt?.toDate().toLocaleDateString('uk-UA', { month: 'long', year: 'numeric' }).replace(/ р\.$/, '') ?? ''
  return label.charAt(0).toUpperCase() + label.slice(1)
}

/**
 * «Історія бонусів» — окремий екран кабінету (у самому кабінеті — лише кілька останніх записів, щоб блок не розтягувався).
 * Зверху — скільки є, скільки отримано й використано; нижче записи, згруповані за місяцями.
 */
export function BonusesPage() {
  const { t } = useTranslation()
  const lang = useLang()
  const { balance } = useBonusBalance()
  const history = useBonusHistory()
  const entries = history.data ?? []
  const earned = entries.filter((e) => e.amount > 0).reduce((sum, e) => sum + e.amount, 0)
  const spent = entries.filter((e) => e.amount < 0).reduce((sum, e) => sum - e.amount, 0)

  const months: { month: string; entries: BonusEntry[] }[] = []
  for (const e of entries) {
    const month = monthOf(e)
    if (months.at(-1)?.month === month) months.at(-1)!.entries.push(e)
    else months.push({ month, entries: [e] })
  }

  return (
    <div className="mx-auto max-w-3xl">
      <BackToAccount />
      <PageTitle>{t('account.history')}</PageTitle>

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="col-span-2 rounded-3xl bg-sunset-600 p-5 text-sand-50 sm:col-span-1">
          <p className="flex items-center gap-2 text-xs font-bold tracking-[0.12em] uppercase">
            <Wallet size={16} strokeWidth={2.5} aria-hidden />
            {t('account.bonuses.now')}
          </p>
          <p className="mt-2 font-display text-3xl font-extrabold">{formatPrice(balance, lang)}</p>
        </div>
        <div className="rounded-3xl border-2 border-sand-200 bg-sand-50 p-4 sm:p-5">
          <p className="text-xs font-bold tracking-[0.12em] text-sand-700 uppercase">{t('account.bonuses.earned')}</p>
          <p className="mt-2 font-display text-2xl font-extrabold text-brand-600 sm:text-3xl">+{formatPrice(earned, lang)}</p>
        </div>
        <div className="rounded-3xl border-2 border-sand-200 bg-sand-50 p-4 sm:p-5">
          <p className="text-xs font-bold tracking-[0.12em] text-sand-700 uppercase">{t('account.bonuses.spent')}</p>
          <p className="mt-2 font-display text-2xl font-extrabold text-sunset-600 sm:text-3xl">−{formatPrice(spent, lang)}</p>
        </div>
      </div>

      {history.isLoading && <p className="text-sand-700">{t('loading')}</p>}
      {history.isError && <p className="text-red-700">{t('errors.loading')}</p>}
      {history.data?.length === 0 && <p className="text-sand-700">{t('account.noHistory')}</p>}

      <div className="space-y-6">
        {months.map(({ month, entries }) => (
          <section key={month}>
            <h2 className="mb-2 flex items-center gap-2 font-display text-lg font-extrabold text-brand-600">
              {month}
            </h2>
            <ul className="divide-y-2 divide-sand-200 rounded-3xl border-2 border-sand-200 bg-sand-50 px-3.5 sm:px-5">
              {entries.map((e) => (
                <BonusRow key={e.id} entry={e} />
              ))}
            </ul>
          </section>
        ))}
      </div>

      <p className="mt-8 flex gap-2 text-sm text-sand-700">
        <Gift {...ICON} className="shrink-0 text-sunset-600" />
        {t('account.balanceHint')}
      </p>
    </div>
  )
}
