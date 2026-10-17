import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Ban,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Clock,
  Inbox,
  Mail,
  MapPin,
  MessageSquare,
  Package,
  Phone,
  Truck,
  User,
  type LucideIcon,
} from 'lucide-react'
import { useLang } from '../../i18n'
import { formatPrice } from '../../lib/format'
import { ORDER_STATUSES, type Order, type OrderStatus } from '../../lib/types'
import { ICON } from '../../shared/icon'
import { ProductImage, Select } from '../../shared/ui'
import { OrderItems } from '../orders/OrderItems'
import { OrderTotals } from '../orders/OrderTotals'
import { useOrders, useUpdateOrder } from './api'
import { OrderItemsEditor } from './OrderItemsEditor'

/** Ті самі статуси, що й в adjustOrder на сервері: склад можна міняти до «Виконане». */
const EDITABLE: OrderStatus[] = ['new', 'confirmed', 'shipped']

/** Колір і значок кожного статусу: смужка зліва на картці, бейдж і кнопка фільтра. */
const STATUS_STYLE: Record<OrderStatus, { badge: string; stripe: string; icon: LucideIcon }> = {
  new: { badge: 'bg-amber-100 text-amber-800', stripe: 'bg-amber-400', icon: Inbox },
  confirmed: { badge: 'bg-sky-100 text-sky-800', stripe: 'bg-sky-400', icon: CheckCircle2 },
  shipped: { badge: 'bg-violet-100 text-violet-800', stripe: 'bg-violet-400', icon: Truck },
  done: { badge: 'bg-brand-100 text-brand-700', stripe: 'bg-brand-500', icon: Package },
  cancelled: { badge: 'bg-sand-200 text-sand-700', stripe: 'bg-sand-300', icon: Ban },
}

/** Наступний крок для великої кнопки: Нове → Підтверджене → Відправлене → Виконане. */
const NEXT: Partial<Record<OrderStatus, OrderStatus>> = { new: 'confirmed', confirmed: 'shipped', shipped: 'done' }

export function OrdersPage() {
  const { t } = useTranslation()
  const { data: orders, isLoading, isError } = useOrders()
  const [filter, setFilter] = useState<OrderStatus | 'all'>('all')
  const [openId, setOpenId] = useState<string | null>(null)

  const visible = orders?.filter((o) => filter === 'all' || o.status === filter) ?? []
  const countBy = (s: OrderStatus) => orders?.filter((o) => o.status === s).length ?? 0

  return (
    <div>
      <h1 className="mb-4 font-display text-3xl font-extrabold text-brand-600">{t('admin.orders')}</h1>

      {/* На телефоні фільтри гортаються вбік одним рядком */}
      <div className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {(['all', ...ORDER_STATUSES] as const).map((s) => {
          const on = filter === s
          const Icon = s === 'all' ? null : STATUS_STYLE[s].icon
          const n = s === 'all' ? (orders?.length ?? 0) : countBy(s)
          return (
            <button
              key={s}
              onClick={() => setFilter(s)}
              aria-pressed={on}
              className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border-2 py-1.5 pr-2 pl-4 text-sm font-bold transition-colors ${
                on ? 'border-brand-600 bg-brand-600 text-sand-50' : 'border-sand-200 bg-sand-50 hover:border-brand-500'
              }`}
            >
              {Icon && <Icon size={16} strokeWidth={2.25} aria-hidden />}
              {s === 'all' ? t('admin.order.filterAll') : t(`admin.statuses.${s}`)}
              <span
                className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[11px] tabular-nums ${
                  on ? 'bg-brand-700 text-sand-100' : 'bg-sand-200 text-sand-700'
                } ${n === 0 ? 'opacity-50' : ''}`}
              >
                {n}
              </span>
            </button>
          )
        })}
      </div>

      {isLoading && <p className="text-sand-700">{t('loading')}</p>}
      {isError && <p className="text-red-700">{t('errors.loading')}</p>}
      {orders && visible.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-3xl border-2 border-dashed border-sand-300 py-12 text-sand-700">
          <Inbox size={32} strokeWidth={1.75} aria-hidden />
          {t('admin.noOrders')}
        </div>
      )}

      <ul className="space-y-3">
        {visible.map((order) => (
          <OrderRow
            key={order.id}
            order={order}
            open={openId === order.id}
            onToggle={() => setOpenId(openId === order.id ? null : order.id)}
          />
        ))}
      </ul>
    </div>
  )
}

function StatusBadge({ status }: { status: OrderStatus }) {
  const { t } = useTranslation()
  const { badge, icon: Icon } = STATUS_STYLE[status]
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${badge}`}>
      <Icon size={14} strokeWidth={2.5} aria-hidden />
      {t(`admin.statuses.${status}`)}
    </span>
  )
}

function OrderRow({ order, open, onToggle }: { order: Order; open: boolean; onToggle: () => void }) {
  const { t } = useTranslation()
  const lang = useLang()
  const update = useUpdateOrder()
  const d = order.delivery
  const date = order.createdAt?.toDate().toLocaleString(lang === 'uk' ? 'uk-UA' : 'en-GB', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
  const isCancelled = order.status === 'cancelled'
  const [editing, setEditing] = useState(false)
  const next = NEXT[order.status]
  const units = order.items.reduce((sum, i) => sum + i.qty, 0)
  const thumbs = order.items.slice(0, 4)

  function changeStatus(status: OrderStatus) {
    if (status === 'cancelled' && !window.confirm(t('admin.order.cancelConfirm', { number: order.number }))) return
    update.mutate({ id: order.id, status })
  }

  return (
    <li
      className={`relative overflow-hidden rounded-3xl border-2 bg-sand-50 transition-shadow ${
        open ? 'border-brand-500 shadow-lg' : 'border-sand-200 hover:shadow-md'
      } ${isCancelled ? 'opacity-75' : ''}`}
    >
      {/* Кольорова смужка статусу — видно здалеку, навіть у згорнутому списку */}
      <span className={`absolute inset-y-0 left-0 w-1.5 ${STATUS_STYLE[order.status].stripe}`} aria-hidden />

      <button onClick={onToggle} aria-expanded={open} className="block w-full py-4 pr-4 pl-6 text-left">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-display text-lg font-extrabold">{order.number}</span>
          <StatusBadge status={order.status} />
          {!isCancelled && (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${
                order.payment.paid ? 'bg-brand-600 text-sand-50' : 'bg-sunset-100 text-sunset-700'
              }`}
            >
              <CircleDollarSign size={14} strokeWidth={2.5} aria-hidden />
              {order.payment.paid ? t('admin.order.paid') : t('admin.order.notPaid')}
            </span>
          )}
          <span className="ml-auto font-display text-xl font-extrabold whitespace-nowrap text-sunset-600">
            {formatPrice(order.total, lang)}
          </span>
        </div>

        <div className="mt-2 space-y-0.5 text-sm">
          <p className="flex items-center gap-1.5 font-bold">
            <User size={15} strokeWidth={2.25} className="shrink-0 text-sand-700" aria-hidden />
            <span className="truncate">{d.fullName}</span>
            {!order.userId && <span className="shrink-0 font-normal text-sand-700">· {t('admin.order.guest')}</span>}
          </p>
          <p className="flex items-center gap-1.5 text-sand-700">
            <Clock size={15} strokeWidth={2.25} className="shrink-0" aria-hidden />
            {date}
          </p>
        </div>

        <div className="mt-3 flex items-center gap-3">
          {/* Мініатюри товарів — одразу видно, що замовили */}
          <div className="flex shrink-0 -space-x-3">
            {thumbs.map((item) => (
              <div key={item.productId} className="w-11 rounded-2xl ring-2 ring-sand-50">
                <ProductImage src={item.image} alt="" />
              </div>
            ))}
            {order.items.length > thumbs.length && (
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sand-200 text-xs font-bold ring-2 ring-sand-50">
                {t('admin.order.moreItems', { count: order.items.length - thumbs.length })}
              </span>
            )}
          </div>
          <span className="min-w-0 flex-1 text-sm text-sand-700">{t('admin.order.itemsCount', { count: units })}</span>
          <ChevronDown {...ICON} className={`shrink-0 text-sand-700 transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {open && (
        <div className="animate-page-in space-y-4 border-t-2 border-sand-200 py-4 pr-4 pl-6 text-sm">
          {/* Головна дія — наступний крок, великою кнопкою під палець */}
          {!isCancelled && (
            <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-sand-100 p-3">
              {next && (
                <button
                  onClick={() => changeStatus(next)}
                  disabled={update.isPending}
                  className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 font-bold text-sand-50 transition hover:bg-brand-700 active:scale-95 disabled:opacity-50 sm:flex-none"
                >
                  <Check {...ICON} />
                  {t(`admin.order.next.${order.status}`)}
                </button>
              )}
              <label
                className={`inline-flex min-h-12 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 px-4 font-bold transition-colors sm:flex-none ${
                  order.payment.paid ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-sand-300 bg-sand-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={order.payment.paid}
                  disabled={update.isPending}
                  onChange={(e) => update.mutate({ id: order.id, payment: { ...order.payment, paid: e.target.checked } })}
                  className="h-5 w-5 accent-brand-600"
                />
                {t('admin.order.paidToggle')}
              </label>
              <div className="w-full sm:ml-auto sm:w-48">
                <Select
                  compact
                  className="w-full"
                  aria-label={t('admin.order.changeStatus')}
                  value={order.status}
                  disabled={update.isPending}
                  onChange={(e) => changeStatus(e.target.value as OrderStatus)}
                >
                  {ORDER_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {t(`admin.statuses.${s}`)}
                    </option>
                  ))}
                </Select>
              </div>
              {update.isError && <p className="w-full text-red-700">{t('admin.saveError')}</p>}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <section className="rounded-2xl border-2 border-sand-200 p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 font-display font-extrabold text-brand-600">
                  <Package size={18} strokeWidth={2.25} aria-hidden />
                  {t('admin.order.items')}
                </h3>
                {!editing && EDITABLE.includes(order.status) && (
                  <button onClick={() => setEditing(true)} className="min-h-10 rounded-lg px-3 font-bold text-brand-600 hover:bg-sand-200">
                    {t('orders.edit')}
                  </button>
                )}
              </div>
              {editing ? <OrderItemsEditor order={order} onDone={() => setEditing(false)} /> : <OrderItems items={order.items} />}
              {order.adjustedAt && !editing && <p className="mt-1 text-xs text-sand-700">{t('orders.adjusted')}</p>}
              {!editing && <OrderTotals order={order} />}
            </section>

            <section className="space-y-2.5 rounded-2xl border-2 border-sand-200 p-4">
              <h3 className="mb-1 flex items-center gap-2 font-display font-extrabold text-brand-600">
                <Truck size={18} strokeWidth={2.25} aria-hidden />
                {t('admin.order.delivery')}
              </h3>
              <ContactLine icon={User}>{d.fullName}</ContactLine>
              <ContactLine icon={Phone}>
                <a href={`tel:${d.phone}`} className="font-bold text-brand-600 hover:underline" aria-label={`${t('admin.order.call')}: ${d.phone}`}>
                  {d.phone}
                </a>
              </ContactLine>
              <ContactLine icon={Mail}>
                <a href={`mailto:${order.email}`} className="break-all text-brand-600 hover:underline">
                  {order.email}
                </a>
              </ContactLine>
              <ContactLine icon={MapPin}>
                {d.city}, {d.warehouse}
              </ContactLine>
              {d.comment && (
                <ContactLine icon={MessageSquare}>
                  <span className="text-sand-700">{d.comment}</span>
                </ContactLine>
              )}
              <ContactLine icon={CircleDollarSign}>
                {order.payment.method === 'cod' ? t('checkout.cod') : t('checkout.cardTransfer')}
              </ContactLine>
            </section>
          </div>
        </div>
      )}
    </li>
  )
}

function ContactLine({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <p className="flex items-start gap-2.5">
      <Icon size={16} strokeWidth={2.25} className="mt-0.5 shrink-0 text-sand-700" aria-hidden />
      <span className="min-w-0">{children}</span>
    </p>
  )
}
