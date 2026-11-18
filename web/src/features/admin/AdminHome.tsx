import { BarChart3, ChevronRight, ClipboardList, LayoutGrid, Users, Wrench, type LucideIcon } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useLang } from '../../i18n'
import { formatPrice } from '../../lib/format'
import { SucculentIcon } from '../../shared/ui'
import { useAllProducts, useOrders } from './api'

/** Колір розділу — фон картки, кружечок зі значком і кнопки-вкладки. Кожен розділ свого кольору, щоб розрізняти з першого погляду. */
const TONES = {
  brand: { card: 'bg-brand-100', icon: 'bg-brand-600 text-sand-50', chip: 'bg-sand-50/70 text-brand-700 hover:bg-sand-50', figure: 'text-brand-700' },
  lavender: { card: 'bg-lavender-100', icon: 'bg-lavender-700 text-sand-50', chip: 'bg-sand-50/70 text-lavender-700 hover:bg-sand-50', figure: 'text-lavender-700' },
  sand: { card: 'bg-sand-200', icon: 'bg-ink text-sand-50', chip: 'bg-sand-50/70 text-ink hover:bg-sand-50', figure: 'text-ink' },
  sunset: { card: 'bg-sunset-100', icon: 'bg-sunset-600 text-sand-50', chip: 'bg-sand-50/70 text-sunset-700 hover:bg-sand-50', figure: 'text-sunset-700' },
} as const

/**
 * Головна адмінки: зверху «Замовлення» (з них починається день) з кількістю нових і тих, що в роботі;
 * нижче чотири розділи — Товари, Аналітика, Покупці, Інструменти. У кожного — жива цифра (де вона є)
 * і кнопки його вкладок, щоб одразу відкрити потрібне (напр. «Категорії» в «Товарах»).
 * Окремої плитки «Додати» немає (на прохання власниці) — кнопка «Додати» є в «Товарах».
 */
export function AdminHome() {
  const { t } = useTranslation()
  const lang = useLang()
  const { data: orders } = useOrders()
  const { data: products } = useAllProducts()
  const fresh = orders?.filter((o) => o.status === 'new').length ?? 0
  const inWork = orders?.filter((o) => o.status === 'confirmed' || o.status === 'shipped').length ?? 0
  // Виручка з початку місяця — без скасованих замовлень
  const revenue = useMemo(() => {
    if (!orders) return undefined
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
    return orders.filter((o) => o.status !== 'cancelled' && (o.createdAt?.toMillis() ?? 0) >= start).reduce((sum, o) => sum + o.total, 0)
  }, [orders])
  const hidden = products?.filter((p) => !p.isActive).length ?? 0

  return (
    <div className="space-y-5">
      {/* «Адмінка» вже видно в меню — заголовок лише для читалок екрана */}
      <h1 className="sr-only">{t('admin.home.title')}</h1>

      {/* Замовлення — найбільша картка: велике число нових видно здалеку */}
      <Link
        to="/admin/orders"
        className="group relative flex items-center gap-5 overflow-hidden rounded-[2rem] bg-sunset-600 p-6 text-sand-50 shadow-sm transition-colors hover:bg-sunset-700 sm:p-8"
      >
        <SucculentIcon className="pointer-events-none absolute -right-6 -bottom-10 h-48 w-48 text-sand-50/15 sm:h-60 sm:w-60" />
        <span className="relative font-display text-7xl leading-none font-extrabold tabular-nums sm:text-8xl">{orders ? fresh : '·'}</span>
        <span className="relative min-w-0 flex-1">
          <span className="flex items-center gap-2 font-display text-2xl font-extrabold sm:text-3xl">
            <ClipboardList size={26} strokeWidth={2.2} aria-hidden />
            {t('admin.orders')}
          </span>
          <span className="mt-1 block text-sand-100">
            {fresh > 0 ? t('admin.home.ordersNew', { count: fresh }) : t('admin.home.ordersNone')}
            {inWork > 0 && `, ${t('admin.home.ordersInWork', { count: inWork })}`}
          </span>
        </span>
        <ChevronRight size={28} strokeWidth={2.4} className="relative shrink-0 transition-transform group-hover:translate-x-1" aria-hidden />
      </Link>

      <div className="grid gap-4 sm:grid-cols-2">
        <Section
          to="/admin/products"
          tone="brand"
          icon={LayoutGrid}
          title={t('admin.list.title')}
          figure={products && t('admin.list.count', { count: products.length })}
          note={hidden > 0 ? t('admin.home.hidden', { count: hidden }) : undefined}
          text={t('admin.home.catalogText')}
          tabs={[
            { to: '/admin/products', label: t('admin.list.tabs.list') },
            { to: '/admin/products?tab=categories', label: t('admin.list.tabs.categories') },
            { to: '/admin/products/new', label: t('admin.addProduct') },
          ]}
        />
        <Section
          to="/admin/analytics"
          tone="sand"
          icon={BarChart3}
          title={t('analytics.title')}
          figure={revenue !== undefined ? formatPrice(revenue, lang) : undefined}
          note={revenue !== undefined ? t('admin.home.revenueMonth') : undefined}
          text={t('admin.home.analyticsText')}
          tabs={[
            { to: '/admin/analytics', label: t('analytics.tabs.sales') },
            { to: '/admin/analytics?tab=plants', label: t('analytics.tabs.plants') },
            { to: '/admin/analytics?tab=pedigrees', label: t('analytics.tabs.pedigrees') },
          ]}
        />
        <Section
          to="/admin/customers"
          tone="lavender"
          icon={Users}
          title={t('admin.customers.title')}
          text={t('admin.home.customersText')}
          tabs={[
            { to: '/admin/customers', label: t('admin.customers.tabs.customers') },
            { to: '/admin/customers?tab=visits', label: t('admin.customers.tabs.visits') },
          ]}
        />
        <Section
          to="/admin/tools"
          tone="sunset"
          icon={Wrench}
          title={t('admin.home.tools')}
          text={t('admin.home.toolsText')}
          tabs={(['import', 'forms', 'names', 'cultivars', 'origins'] as const).map((id) => ({
            to: id === 'import' ? '/admin/tools' : `/admin/tools?tab=${id}`,
            label: t(`admin.fixes.tabsShort.${id}`),
          }))}
        />
      </div>
    </div>
  )
}

/**
 * Розділ адмінки. Уся картка веде в розділ (назва — посилання, розтягнуте на всю картку),
 * а кнопки знизу — одразу на потрібну вкладку (лежать поверх, тож натискаються окремо).
 */
function Section({
  to,
  tone,
  icon: Icon,
  title,
  figure,
  note,
  text,
  tabs,
}: {
  to: string
  tone: keyof typeof TONES
  icon: LucideIcon
  title: string
  figure?: string
  note?: string
  text: string
  tabs: { to: string; label: string }[]
}) {
  const c = TONES[tone]
  return (
    <section className={`group relative flex flex-col gap-4 rounded-[2rem] p-5 transition-shadow hover:shadow-md sm:p-6 ${c.card}`}>
      <div className="flex items-start gap-3">
        <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${c.icon}`}>
          <Icon size={24} strokeWidth={2.2} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-2xl leading-tight font-extrabold text-ink">
            <Link to={to} className="after:absolute after:inset-0 after:rounded-[2rem]">
              {title}
            </Link>
          </h2>
          {figure && (
            <p className="mt-0.5">
              <span className={`font-display text-lg font-bold tabular-nums ${c.figure}`}>{figure}</span>
              {note && <span className="text-sm text-sand-700">, {note}</span>}
            </p>
          )}
        </div>
        <ChevronRight size={22} strokeWidth={2.4} className="mt-2 shrink-0 text-sand-700 transition-transform group-hover:translate-x-1" aria-hidden />
      </div>
      <p className="text-sm leading-relaxed text-sand-700">{text}</p>
      <div className="relative mt-auto flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <Link key={tab.to} to={tab.to} className={`inline-flex min-h-9 items-center rounded-full px-3.5 text-sm font-bold transition-colors ${c.chip}`}>
            {tab.label}
          </Link>
        ))}
      </div>
    </section>
  )
}
