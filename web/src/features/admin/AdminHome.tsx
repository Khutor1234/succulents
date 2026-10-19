import { BarChart3, ChevronRight, ClipboardList, FileSpreadsheet, LayoutGrid, Plus, Sparkles, Tags, Users, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { PLANT_CATEGORY } from '../../lib/plants'
import { useOrders } from './api'

/**
 * Головна адмінки — коротка «карта» всього, що є: замовлення зверху (найважливіше щодня),
 * далі товари (керуються прямо в магазині), налаштування магазину й окремо інструменти для масових змін.
 */
export function AdminHome() {
  const { t } = useTranslation()
  const { data: orders } = useOrders()
  const fresh = orders?.filter((o) => o.status === 'new').length ?? 0
  const inWork = orders?.filter((o) => o.status === 'confirmed' || o.status === 'shipped').length ?? 0

  return (
    <div className="space-y-8">
      <h1 className="font-display text-3xl font-extrabold text-brand-600">{t('admin.home.title')}</h1>

      {/* Замовлення — велика плитка: з неї починається день */}
      <Link
        to="/admin/orders"
        className="group flex items-center gap-4 rounded-3xl bg-sunset-600 p-5 text-sand-50 shadow-sm transition-colors hover:bg-sunset-700"
      >
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-sand-50/15">
          <ClipboardList size={28} strokeWidth={2.2} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-2xl font-extrabold">{t('admin.orders')}</span>
          <span className="block text-sm text-sand-100">
            {fresh > 0 ? t('admin.home.ordersNew', { count: fresh }) : t('admin.home.ordersNone')}
            {inWork > 0 && ` · ${t('admin.home.ordersInWork', { count: inWork })}`}
          </span>
        </span>
        <ChevronRight size={24} strokeWidth={2.4} className="shrink-0 transition-transform group-hover:translate-x-1" aria-hidden />
      </Link>

      <Group title={t('admin.home.products')} hint={t('admin.home.productsHint')}>
        <Tile to={`/c/${PLANT_CATEGORY}`} icon={LayoutGrid} title={t('admin.home.catalog')} text={t('admin.home.catalogText')} />
        <Tile to="/admin/products/new" icon={Plus} title={t('admin.addProduct')} text={t('admin.home.addText')} accent />
      </Group>

      <Group title={t('admin.home.shop')}>
        <Tile to="/admin/categories" icon={Tags} title={t('admin.categories')} text={t('admin.home.categoriesText')} />
        <Tile to="/admin/customers" icon={Users} title={t('admin.customers.title')} text={t('admin.home.customersText')} />
        <Tile to="/admin/analytics" icon={BarChart3} title={t('analytics.title')} text={t('admin.home.analyticsText')} />
      </Group>

      <Group title={t('admin.home.tools')} hint={t('admin.home.toolsHint')}>
        <Tile to="/admin/import" icon={FileSpreadsheet} title={t('admin.importFromSheet')} text={t('admin.home.importText')} />
        <Tile to="/admin/forms" icon={Sparkles} title={t('admin.formFixes.title')} text={t('admin.home.formsText')} />
      </Group>
    </div>
  )
}

function Group({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-xl font-extrabold text-ink">{title}</h2>
      {hint && <p className="mt-0.5 text-sm text-sand-700">{hint}</p>}
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  )
}

function Tile({ to, icon: Icon, title, text, accent }: { to: string; icon: LucideIcon; title: string; text: string; accent?: boolean }) {
  return (
    <Link
      to={to}
      className={`group flex items-start gap-3 rounded-3xl border-2 p-4 transition-colors ${
        accent ? 'border-brand-600 bg-brand-600 text-sand-50 hover:bg-brand-700' : 'border-sand-200 bg-sand-50 hover:border-brand-500'
      }`}
    >
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${accent ? 'bg-sand-50/15' : 'bg-brand-100 text-brand-600'}`}
      >
        <Icon size={22} strokeWidth={2.2} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-bold">{title}</span>
        <span className={`mt-0.5 block text-sm leading-snug ${accent ? 'text-sand-100' : 'text-sand-700'}`}>{text}</span>
      </span>
      <ChevronRight size={20} strokeWidth={2.4} className={`mt-3 shrink-0 transition-transform group-hover:translate-x-1 ${accent ? '' : 'text-sand-700'}`} aria-hidden />
    </Link>
  )
}
