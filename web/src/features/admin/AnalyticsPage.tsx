import {
  Ban,
  CalendarDays,
  Clock,
  Crown,
  Gem,
  MapPin,
  Package,
  Receipt,
  Repeat,
  ShoppingBag,
  Sparkles,
  Sprout,
  Trophy,
  UserPlus,
  Wallet,
  Leaf,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useLang } from '../../i18n'
import { formatPrice, pick } from '../../lib/format'
import { PLANT_CATEGORY } from '../../lib/plants'
import type { Order } from '../../lib/types'
import { ProductImage } from '../../shared/ui'
import { useAllProducts, useOrders } from './api'
import { Bar, Card, Fact, RankList, Tile } from './analyticsUi'
import { PlantAnalytics } from './PlantAnalytics'

const PERIODS = [7, 30, 90, 0] as const // 0 — увесь час
type Period = (typeof PERIODS)[number]
const DAY = 86_400_000

/** Чи враховувати замовлення у виручці: скасовані — ні. */
const counts = (o: Order) => o.status !== 'cancelled'
const dateOf = (o: Order) => o.createdAt?.toDate() ?? new Date(0)

interface Bucket {
  start: Date
  revenue: number
  orders: number
}

/** Виручка по днях (до 30 днів) або тижнях — для стовпчикової діаграми. */
function bucketize(orders: Order[], from: Date, to: Date): { buckets: Bucket[]; weekly: boolean } {
  const days = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / DAY))
  const weekly = days > 31
  const size = weekly ? 7 * DAY : DAY
  const start = new Date(from)
  start.setHours(0, 0, 0, 0)
  const n = Math.ceil((to.getTime() - start.getTime()) / size)
  const buckets: Bucket[] = Array.from({ length: n }, (_, i) => ({ start: new Date(start.getTime() + i * size), revenue: 0, orders: 0 }))
  for (const o of orders) {
    const i = Math.floor((dateOf(o).getTime() - start.getTime()) / size)
    if (buckets[i]) {
      buckets[i].revenue += o.total
      buckets[i].orders += 1
    }
  }
  return { buckets, weekly }
}

function topBy<T>(map: Map<T, number>, n: number): [T, number][] {
  return [...map].sort((a, b) => b[1] - a[1]).slice(0, n)
}

function add<T>(map: Map<T, number>, key: T, value: number) {
  map.set(key, (map.get(key) ?? 0) + value)
}

function SalesAnalytics() {
  const { t } = useTranslation()
  const lang = useLang()
  const { data: orders, isLoading, isError } = useOrders()
  const { data: products } = useAllProducts()
  const [period, setPeriod] = useState<Period>(30)
  // «Зараз» фіксуємо при відкритті сторінки — щоб підрахунки не змінювались від перемальовування.
  const [now] = useState(() => new Date())

  const stats = useMemo(() => {
    if (!orders) return null
    const all = orders.filter((o) => o.createdAt)
    const earliest = all.reduce((min, o) => Math.min(min, dateOf(o).getTime()), now.getTime())
    const from = period ? new Date(now.getTime() - period * DAY) : new Date(earliest)
    const inPeriod = all.filter((o) => dateOf(o) >= from)
    const valid = inPeriod.filter(counts)
    const cancelled = inPeriod.length - valid.length

    const revenue = valid.reduce((s, o) => s + o.total, 0)
    const units = valid.reduce((s, o) => s + o.items.reduce((u, i) => u + i.qty, 0), 0)
    const productById = new Map((products ?? []).map((p) => [p.id, p]))

    // Товари, види, особливості, міста, дні тижня, години.
    const productUnits = new Map<string, number>()
    const productRevenue = new Map<string, number>()
    const genusUnits = new Map<string, number>()
    const tagUnits = new Map<string, number>()
    const cityOrders = new Map<string, number>()
    const weekday = new Map<number, number>()
    const hours = new Map<number, number>()
    const buyerOrders = new Map<string, number>()
    const buyerRevenue = new Map<string, number>()
    const buyerName = new Map<string, string>()
    let plantUnits = 0
    for (const o of valid) {
      add(cityOrders, o.delivery.city.trim(), 1)
      add(weekday, dateOf(o).getDay(), 1)
      add(hours, dateOf(o).getHours(), 1)
      const buyer = o.userId ?? o.email.toLowerCase()
      add(buyerOrders, buyer, 1)
      add(buyerRevenue, buyer, o.total)
      buyerName.set(buyer, o.delivery.fullName)
      for (const i of o.items) {
        if (!i.qty) continue
        add(productUnits, i.productId, i.qty)
        add(productRevenue, i.productId, i.qty * i.price)
        const p = productById.get(i.productId)
        if (p?.category === PLANT_CATEGORY) plantUnits += i.qty
        if (p?.genus) add(genusUnits, p.genus, i.qty)
        for (const tag of p?.tags ?? []) add(tagUnits, tag, i.qty)
      }
    }
    const repeatBuyers = [...buyerOrders.values()].filter((n) => n > 1).length
    const biggest = valid.reduce<Order | null>((max, o) => (!max || o.total > max.total ? o : max), null)
    const registered = valid.filter((o) => o.userId).length
    const bonusUsed = valid.reduce((s, o) => s + (o.bonusUsed ?? 0), 0)
    const topBuyer = topBy(buyerRevenue, 1)[0]

    return {
      from,
      inPeriod,
      valid,
      revenue,
      units,
      plantUnits,
      cancelled,
      // Середній чек — у цілих гривнях.
      avg: valid.length ? Math.round(revenue / valid.length / 100) * 100 : 0,
      chart: bucketize(valid, from, now),
      topProducts: topBy(productUnits, 8).map(([id, qty]) => ({
        id,
        qty,
        revenue: productRevenue.get(id) ?? 0,
        product: productById.get(id),
        name: productById.get(id)?.name ?? valid.flatMap((o) => o.items).find((i) => i.productId === id)?.name,
        image: productById.get(id)?.images[0],
      })),
      topGenera: topBy(genusUnits, 6),
      topCities: topBy(cityOrders, 5),
      statusCounts: ['new', 'confirmed', 'shipped', 'done', 'cancelled'].map((s) => [s, inPeriod.filter((o) => o.status === s).length] as const),
      facts: {
        bestWeekday: topBy(weekday, 1)[0],
        peakHour: topBy(hours, 1)[0],
        biggest,
        topBuyer: topBuyer ? { name: buyerName.get(topBuyer[0]) ?? '', revenue: topBuyer[1], orders: buyerOrders.get(topBuyer[0]) ?? 0 } : null,
        repeatShare: buyerOrders.size ? Math.round((repeatBuyers / buyerOrders.size) * 100) : 0,
        registeredShare: valid.length ? Math.round((registered / valid.length) * 100) : 0,
        topTag: topBy(tagUnits, 1)[0],
        topCity: topBy(cityOrders, 1)[0],
        bonusUsed,
      },
    }
  }, [orders, products, period, now])

  if (isLoading) return <p className="text-sand-700">{t('loading')}</p>
  if (isError || !stats) return <p className="text-red-700">{t('errors.loading')}</p>

  const { facts } = stats
  const weekdayName = (d: number) => new Date(2024, 0, 7 + d).toLocaleDateString('uk-UA', { weekday: 'long' })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-end gap-3">
        {/* Період — один рядок перемикачів над усіма графіками */}
        <div className="flex rounded-2xl bg-sand-200 p-1" role="radiogroup" aria-label={t('analytics.period')}>
          {PERIODS.map((p) => (
            <button
              key={p}
              role="radio"
              aria-checked={period === p}
              onClick={() => setPeriod(p)}
              className={`min-h-10 rounded-xl px-2.5 text-sm font-bold whitespace-nowrap transition-colors sm:px-4 ${
                period === p ? 'bg-sand-50 text-ink shadow-sm' : 'text-sand-700 hover:text-ink'
              }`}
            >
              {p ? t('analytics.days', { count: p }) : t('analytics.allTime')}
            </button>
          ))}
        </div>
      </div>

      {stats.inPeriod.length === 0 ? (
        <p className="rounded-3xl border-2 border-dashed border-sand-300 py-12 text-center text-sand-700">{t('analytics.empty')}</p>
      ) : (
        <>
          {/* Головні цифри */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile icon={Wallet} label={t('analytics.revenue')} value={formatPrice(stats.revenue, lang)} accent />
            <Tile icon={Receipt} label={t('analytics.orders')} value={String(stats.valid.length)} hint={stats.cancelled ? t('analytics.cancelledHint', { count: stats.cancelled }) : undefined} />
            <Tile icon={ShoppingBag} label={t('analytics.avgOrder')} value={formatPrice(stats.avg, lang)} />
            <Tile icon={Sprout} label={t('analytics.plantsSold')} value={String(stats.plantUnits)} hint={t('analytics.unitsHint', { count: stats.units })} />
          </div>

          <Card title={t(stats.chart.weekly ? 'analytics.revenueByWeek' : 'analytics.revenueByDay')} icon={CalendarDays}>
            <RevenueChart buckets={stats.chart.buckets} weekly={stats.chart.weekly} />
          </Card>

          <div className="grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
            <Card title={t('analytics.topProducts')} icon={Trophy}>
              <ol className="space-y-3">
                {stats.topProducts.map((p, i) => (
                  <li key={p.id} className="flex items-center gap-3">
                    <span className="w-5 shrink-0 text-center font-display font-extrabold text-sand-700 tabular-nums">{i + 1}</span>
                    <div className="w-10 shrink-0">
                      <ProductImage src={p.image} alt="" />
                    </div>
                    <div className="min-w-0 flex-1">
                      {/* Товар, що ще є в базі, — посилання на його сторінку; видалений — просто назва із замовлень */}
                      {p.product ? (
                        <Link to={`/product/${p.product.slug}`} className="block truncate text-sm font-bold hover:text-brand-600 hover:underline">
                          {pick(p.product.name, lang)}
                        </Link>
                      ) : (
                        <p className="truncate text-sm font-bold">{p.name ? pick(p.name, lang) : p.id}</p>
                      )}
                      <Bar value={p.qty} max={stats.topProducts[0].qty} />
                    </div>
                    <div className="shrink-0 text-right text-sm">
                      <p className="font-bold tabular-nums">{t('analytics.pcs', { count: p.qty })}</p>
                      <p className="text-xs text-sand-700">{formatPrice(p.revenue, lang)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </Card>

            <div className="space-y-6">
              <Card title={t('analytics.topGenera')} icon={Sprout}>
                <RankList rows={stats.topGenera.map(([g, n]) => ({ key: g, label: (
                      <Link to={`/c/plants?genus=${encodeURIComponent(g)}`} className="italic hover:text-brand-600 hover:underline">
                        {g}
                      </Link>
                    ),
                    value: n, text: t('analytics.pcs', { count: n }) }))} />
              </Card>
              <Card title={t('analytics.topCities')} icon={MapPin}>
                <RankList rows={stats.topCities.map(([c, n]) => ({ key: c, label: c, value: n, text: t('analytics.ordersCount', { count: n }) }))} />
              </Card>
            </div>
          </div>

          {/* Цікаві факти — короткі «картки-відкриття» */}
          <section>
            <h2 className="mb-3 flex items-center gap-2 font-display text-xl font-extrabold text-brand-600">
              <Sparkles size={20} strokeWidth={2.25} aria-hidden />
              {t('analytics.facts')}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {facts.bestWeekday && (
                <Fact icon={CalendarDays} title={t('analytics.factWeekday', { day: weekdayName(facts.bestWeekday[0]) })}>
                  {t('analytics.factWeekdayText', { count: facts.bestWeekday[1] })}
                </Fact>
              )}
              {facts.peakHour && (
                <Fact icon={Clock} title={t('analytics.factHour', { from: facts.peakHour[0], to: facts.peakHour[0] + 1 })}>
                  {t('analytics.factHourText')}
                </Fact>
              )}
              {facts.biggest && (
                <Fact icon={Gem} title={t('analytics.factBiggest', { amount: formatPrice(facts.biggest.total, lang) })}>
                  {t('analytics.factBiggestText', { number: facts.biggest.number, name: facts.biggest.delivery.fullName })}
                </Fact>
              )}
              {facts.topBuyer && (
                <Fact icon={Crown} title={t('analytics.factTopBuyer', { name: facts.topBuyer.name })}>
                  {t('analytics.factTopBuyerText', { count: facts.topBuyer.orders, amount: formatPrice(facts.topBuyer.revenue, lang) })}
                </Fact>
              )}
              <Fact icon={Repeat} title={t('analytics.factRepeat', { percent: facts.repeatShare })}>
                {t('analytics.factRepeatText')}
              </Fact>
              <Fact icon={UserPlus} title={t('analytics.factRegistered', { percent: facts.registeredShare })}>
                {t('analytics.factRegisteredText')}
              </Fact>
              {facts.topTag && (
                <Fact icon={Sparkles} title={t('analytics.factTag', { tag: t(`tags.${facts.topTag[0]}`) })}>
                  {t('analytics.factTagText', { count: facts.topTag[1] })}
                </Fact>
              )}
              {facts.topCity && (
                <Fact icon={MapPin} title={t('analytics.factCity', { city: facts.topCity[0] })}>
                  {t('analytics.factCityText', { percent: Math.round((facts.topCity[1] / stats.valid.length) * 100) })}
                </Fact>
              )}
              {facts.bonusUsed > 0 && (
                <Fact icon={Wallet} title={t('analytics.factBonus', { amount: formatPrice(facts.bonusUsed, lang) })}>
                  {t('analytics.factBonusText')}
                </Fact>
              )}
            </div>
          </section>

          <Card title={t('analytics.statuses')} icon={Package}>
            <RankList
              rows={stats.statusCounts.map(([s, n]) => ({
                key: s,
                label: (
                  <span className="inline-flex items-center gap-1.5">
                    {s === 'cancelled' && <Ban size={14} strokeWidth={2.5} aria-hidden />}
                    {t(`admin.statuses.${s}`)}
                  </span>
                ),
                value: n,
                text: String(n),
              }))}
              max={stats.inPeriod.length}
            />
          </Card>
          {orders && orders.length >= 200 && <p className="text-xs text-sand-700">{t('analytics.limitNote')}</p>}
        </>
      )}
    </div>
  )
}

/** Стовпчики виручки: наведення чи дотик показує суму й кількість замовлень за день/тиждень. */
function RevenueChart({ buckets, weekly }: { buckets: Bucket[]; weekly: boolean }) {
  const { t } = useTranslation()
  const lang = useLang()
  const [active, setActive] = useState<number | null>(null)
  const max = Math.max(1, ...buckets.map((b) => b.revenue))
  const fmt = (d: Date) => d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })
  const label = (b: Bucket) => (weekly ? t('analytics.weekOf', { date: fmt(b.start) }) : fmt(b.start))
  const shown = active !== null ? buckets[active] : null
  // Підписи під віссю — лише кілька, щоб не налазили один на одного.
  const every = Math.ceil(buckets.length / 6)

  return (
    <div>
      {/* Рядок над графіком: підказка або дані вибраного стовпчика. На телефоні — до двох рядків висоти,
          щоб текст не налазив на графік; підказка там коротша («торкніться»), на комп’ютері — «наведіть». */}
      <p className="mb-3 min-h-10 text-sm leading-5 text-sand-700 sm:min-h-5" aria-live="polite">
        {shown ? (
          <>
            <strong className="text-ink">{label(shown)}</strong> · {formatPrice(shown.revenue, lang)} · {t('analytics.ordersCount', { count: shown.orders })}
          </>
        ) : (
          <>
            <span className="sm:hidden">{t('analytics.chartHintTouch')}</span>
            <span className="hidden sm:inline">{t('analytics.chartHint')}</span>
          </>
        )}
      </p>
      <div className="relative h-44 border-b-2 border-sand-200" onMouseLeave={() => setActive(null)}>
        {/* Легка сітка: половина й максимум */}
        <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-sand-200" />
        <div className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-sand-200" />
        <span className="pointer-events-none absolute top-0.5 left-0 rounded bg-sand-50/90 px-1 text-[11px] text-sand-700">{formatPrice(max, lang)}</span>
        <div className="flex h-full items-end gap-0.5">
          {buckets.map((b, i) => (
            <button
              key={i}
              type="button"
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onClick={() => setActive(i)}
              aria-label={`${label(b)}: ${formatPrice(b.revenue, lang)}`}
              className="flex h-full flex-1 items-end"
            >
              <span
                className={`w-full rounded-t-[4px] transition-colors ${active === i ? 'bg-sunset-500' : 'bg-brand-500'} ${b.revenue ? '' : 'opacity-0'}`}
                style={{ height: `${Math.max(2, (b.revenue / max) * 100)}%` }}
              />
            </button>
          ))}
        </div>
      </div>
      <div className="mt-1 flex gap-0.5 text-[11px] text-sand-700">
        {buckets.map((b, i) => (
          <span key={i} className="flex-1 overflow-visible text-center whitespace-nowrap">
            {i % every === 0 ? fmt(b.start) : ''}
          </span>
        ))}
      </div>
    </div>
  )
}


const TABS = ['sales', 'plants'] as const
type Tab = (typeof TABS)[number]

/** Аналітика: дві вкладки — продажі (замовлення) і рослини (що є в асортименті). Вкладка — в адресі (?tab=plants). */
export function AnalyticsPage() {
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()
  const tab: Tab = params.get('tab') === 'plants' ? 'plants' : 'sales'
  const TAB_ICONS = { sales: Receipt, plants: Leaf }
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto font-display text-3xl font-extrabold text-brand-600">{t('analytics.title')}</h1>
        <div className="flex rounded-2xl bg-sand-200 p-1" role="tablist" aria-label={t('analytics.title')}>
          {TABS.map((id) => {
            const Icon = TAB_ICONS[id]
            return (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                onClick={() => setParams(id === 'sales' ? {} : { tab: id }, { replace: true })}
                className={`inline-flex min-h-10 items-center gap-1.5 rounded-xl px-4 text-sm font-bold transition-colors ${
                  tab === id ? 'bg-brand-600 text-sand-50 shadow-sm' : 'text-sand-700 hover:text-ink'
                }`}
              >
                <Icon size={16} strokeWidth={2.25} aria-hidden />
                {t(`analytics.tabs.${id}`)}
              </button>
            )
          })}
        </div>
      </div>
      {tab === 'sales' ? <SalesAnalytics /> : <PlantAnalytics />}
    </div>
  )
}
