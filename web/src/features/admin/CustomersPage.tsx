import { useQuery } from '@tanstack/react-query'
import { CalendarDays, Phone } from 'lucide-react'
import { httpsCallable } from 'firebase/functions'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { functions } from '../../firebase/config'
import { useLang } from '../../i18n'
import { formatPrice } from '../../lib/format'
import { Select } from '../../shared/ui'

interface CustomerRow {
  uid: string
  email: string | null
  displayName: string | null
  provider: 'google' | 'password' | 'other'
  emailVerified: boolean
  isSeller: boolean
  createdAt: string | null
  lastSignInAt: string | null
  balance: number
  ordersCount: number
  spent: number
  fullName: string | null
  phone: string | null
}

const listCustomers = httpsCallable<void, { customers: CustomerRow[] }>(functions, 'listCustomers')

const SORTS = ['balance', 'new', 'orders', 'spent'] as const
type Sort = (typeof SORTS)[number]
const COMPARE: Record<Sort, (a: CustomerRow, b: CustomerRow) => number> = {
  balance: (a, b) => b.balance - a.balance,
  new: (a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''),
  orders: (a, b) => b.ordersCount - a.ordersCount,
  spent: (a, b) => b.spent - a.spent,
}

const date = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

export function CustomersPage() {
  const { t } = useTranslation()
  const lang = useLang()
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['admin', 'customers'],
    queryFn: async () => (await listCustomers()).data.customers,
    staleTime: 0,
  })
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<Sort>('balance')

  const q = search.trim().toLowerCase()
  const rows = (data ?? [])
    .filter((c) => !q || [c.email, c.fullName, c.displayName, c.phone].some((v) => v?.toLowerCase().includes(q)))
    .sort(COMPARE[sort])
  const totalBonuses = (data ?? []).reduce((sum, c) => sum + Math.max(0, c.balance), 0)

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-extrabold text-brand-600">{t('admin.customers.title')}</h1>
        <button
          onClick={() => void refetch()}
          disabled={isFetching}
          className="min-h-10 rounded-xl px-3 text-sm font-bold text-brand-600 hover:bg-sand-200 disabled:opacity-50"
        >
          {isFetching ? t('loading') : t('admin.customers.refresh')}
        </button>
      </div>

      {data && (
        <div className="mb-4 grid grid-cols-3 gap-2 sm:gap-3">
          <Stat label={t('admin.customers.total')} value={String(data.length)} />
          <Stat label={t('admin.customers.withBonuses')} value={String(data.filter((c) => c.balance > 0).length)} />
          {/* Скільки бонусів зараз «висить» на рахунках — це майбутні знижки, які магазин має покрити */}
          <Stat label={t('admin.customers.bonusesTotal')} value={formatPrice(totalBonuses, lang)} accent />
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="min-w-60 flex-1">
          <span className="mb-1.5 block text-sm font-medium text-sand-700">{t('admin.customers.search')}</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            // Enter — сховати клавіатуру (шукаємо й так одразу під час набору)
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            enterKeyHint="search"
            placeholder={t('admin.customers.searchPlaceholder')}
            className="w-full rounded-xl border-2 border-sand-200 bg-sand-50 px-3.5 py-2.5 focus:border-brand-500 focus:outline-none"
          />
        </label>
        <Select label={t('catalog.sort')} value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
          {SORTS.map((s) => (
            <option key={s} value={s}>
              {t(`admin.customers.sorts.${s}`)}
            </option>
          ))}
        </Select>
      </div>

      {isLoading && <p className="text-sand-700">{t('loading')}</p>}
      {isError && <p className="text-red-700">{t('errors.loading')}</p>}
      {data && rows.length === 0 && <p className="text-sand-700">{t('admin.customers.empty')}</p>}

      {/* Картки замість таблиці — однаково зручно з телефона й комп'ютера */}
      {rows.length > 0 && (
        <ul className="space-y-3">
          {rows.map((c, i) => (
            <li
              key={c.uid}
              style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}
              className="grid animate-rise gap-3 rounded-3xl border-2 border-sand-200 bg-sand-50 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
            >
              <div className="min-w-0">
                <p className="font-bold">{c.fullName || c.displayName || '—'}</p>
                <p className="truncate text-sm text-sand-700">{c.email}</p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {c.provider === 'google' && <Badge className="bg-sand-200">Google</Badge>}
                  {c.isSeller && <Badge className="bg-brand-100 text-brand-700">{t('admin.customers.seller')}</Badge>}
                  {!c.emailVerified && <Badge className="bg-[#f3e7a8] text-[#5c4a00]">{t('admin.customers.unverified')}</Badge>}
                </div>
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-sand-700">
                  {c.phone && (
                    <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1.5 font-medium text-brand-600 hover:underline">
                      <Phone size={15} strokeWidth={2.25} aria-hidden />
                      {c.phone}
                    </a>
                  )}
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays size={15} strokeWidth={2.25} aria-hidden />
                    {date(c.createdAt)} · {t('admin.customers.lastSeen')} {date(c.lastSignInAt)}
                  </span>
                </div>
              </div>

              {/* Цифри: замовлення, витрачено, бонуси (найважливіше — найбільше) */}
              <div className="grid grid-cols-3 gap-2 text-center sm:min-w-80">
                <div className="rounded-2xl bg-sand-100 px-2 py-2">
                  <p className="text-xs text-sand-700">{t('admin.customers.orders')}</p>
                  <p className="font-bold tabular-nums">{c.ordersCount}</p>
                </div>
                <div className="rounded-2xl bg-sand-100 px-2 py-2">
                  <p className="text-xs text-sand-700">{t('admin.customers.spent')}</p>
                  <p className="font-bold whitespace-nowrap tabular-nums">{formatPrice(c.spent, lang)}</p>
                </div>
                <div className={`rounded-2xl px-2 py-2 ${c.balance > 0 ? 'bg-sunset-600 text-sand-50' : 'bg-sand-100'}`}>
                  <p className={`text-xs ${c.balance > 0 ? '' : 'text-sand-700'}`}>{t('admin.customers.balance')}</p>
                  <p className="font-display text-lg leading-tight font-extrabold whitespace-nowrap tabular-nums">
                    {formatPrice(c.balance, lang)}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl p-3 sm:p-4 ${accent ? 'bg-sunset-600 text-sand-50' : 'border-2 border-sand-200 bg-sand-50'}`}>
      <p className={`text-xs leading-tight font-medium sm:text-sm ${accent ? '' : 'text-sand-700'}`}>{label}</p>
      <p className="mt-1 font-display text-xl font-extrabold whitespace-nowrap sm:text-3xl">{value}</p>
    </div>
  )
}

function Badge({ children, className }: { children: string; className: string }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${className}`}>{children}</span>
}
