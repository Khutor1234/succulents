import { ArrowRight, ChevronLeft, ChevronRight, EyeOff, Leaf } from 'lucide-react'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useLang } from '../../i18n'
import { formatPrice, pick } from '../../lib/format'
import { PLANT_CATEGORY, type PlantTag } from '../../lib/plants'
import type { Product } from '../../lib/types'
import { ProductImage } from '../../shared/ui'
import { useAuth } from '../auth/authStore'
import { useAllProducts } from '../catalog/api'

export interface ExampleFilter {
  genera?: string[]
  tags?: PlantTag[]
  breeders?: string[]
}

const genusOf = (p: Product) => p.genus || p.name.uk.trim().split(/\s+/)[0]
const norm = (s: string) => s.trim().toLowerCase()

/** Рослини магазину, що підходять: показані, потрібного роду / форми / селекціонера. Спершу з фото й у наявності. */
function pickExamples(data: Product[], filter: ExampleFilter, max: number, withHidden: boolean): Product[] {
  const fits = (p: Product, tag?: PlantTag) =>
    p.category === PLANT_CATEGORY &&
    (withHidden || p.isActive) &&
    (!filter.genera || filter.genera.includes(genusOf(p))) &&
    (!filter.breeders || filter.breeders.some((b) => norm(p.breeder ?? '').includes(norm(b)))) &&
    (!tag || p.tags?.includes(tag))
  // Спершу показані з фото й у наявності; приховані (їх бачить лише продавець) — у кінці
  const rank = (p: Product) => Number(!p.isActive) * 4 + Number(p.images.length === 0) * 2 + Number(p.stock === 0)
  const sorted = (list: Product[]) => [...list].sort((a, b) => rank(a) - rank(b))
  if (!filter.tags?.length) return sorted(data.filter((p) => fits(p))).slice(0, max)
  // Кілька форм — по черзі з кожної, щоб були видні всі (варієгата, кристата, монстроза…)
  const groups = filter.tags.map((tag) => sorted(data.filter((p) => fits(p, tag))))
  const seen = new Set<string>()
  const out: Product[] = []
  for (let i = 0; out.length < max && groups.some((g) => g[i]); i++)
    for (const g of groups) {
      const p = g[i]
      if (p && !seen.has(p.id) && out.length < max) {
        seen.add(p.id)
        out.push(p)
      }
    }
  return out
}

/**
 * Приклади з колекції в статті: картки з фото, назвою й ціною — без кошика; натиснули — сторінка рослини.
 * - `compact` — усередині тексту, під розділом про конкретний рід: усі підхожі рослини стрічкою, яку гортають убік;
 * - інакше — окремий блок «Приклади з нашої колекції» наприкінці статті.
 * Немає підхожих рослин у магазині — нічого не показуємо.
 */
export function ArticleExamples({ filter, compact = false }: { filter: ExampleFilter; compact?: boolean }) {
  const { t } = useTranslation()
  const lang = useLang()
  // Покупцям — лише показані рослини; продавцю — усі, разом із прихованими (з позначкою «Приховано»)
  const isSeller = useAuth((s) => s.role === 'seller')
  const { data } = useAllProducts(isSeller)
  const strip = useRef<HTMLUListElement>(null)
  if (!data) return null
  // Усередині тексту — усі підхожі рослини стрічкою, яку гортають убік; наприкінці статті — до 8 сіткою
  const shown = pickExamples(data, filter, compact ? Infinity : 8, isSeller)
  if (shown.length === 0) return null

  const card = (p: Product, i: number) => (
    <Link to={`/product/${p.slug}`} className="group block rounded-2xl border-2 border-sand-200 bg-sand-50 p-2 transition-colors hover:border-brand-500">
      <div className="relative overflow-hidden rounded-xl">
        {!p.isActive && (
          <span className="absolute top-1.5 left-1.5 z-10 inline-flex items-center gap-1 rounded-md bg-lavender-700/90 px-1.5 py-0.5 text-[10px] font-extrabold tracking-wide text-sand-50 uppercase">
            <EyeOff size={11} strokeWidth={2.75} aria-hidden />
            {t('product.hidden')}
          </span>
        )}
        <div className="transition-transform duration-500 group-hover:scale-[1.04]">
          <ProductImage src={p.images[0]} alt={pick(p.name, lang)} tint={i % 2 ? 'bg-brand-100' : 'bg-sand-300/60'} />
        </div>
      </div>
      <p className="mt-2 line-clamp-2 px-0.5 text-sm leading-snug font-bold group-hover:text-brand-600">{pick(p.name, lang)}</p>
      <p className="px-0.5 text-sm font-extrabold text-sunset-600">{formatPrice(p.price, lang)}</p>
    </Link>
  )

  if (compact) {
    // Плавно на ~екран убік; якщо браузер плавну прокрутку не виконав (буває разом із «прилипанням» карток) — одразу
    const scroll = (dir: number) => {
      const el = strip.current
      if (!el) return
      const from = el.scrollLeft
      const to = Math.max(0, Math.min(el.scrollWidth - el.clientWidth, from + dir * el.clientWidth * 0.8))
      el.scrollTo({ left: to, behavior: 'smooth' })
      setTimeout(() => {
        if (Math.abs(el.scrollLeft - from) < 2) el.scrollLeft = to
      }, 450)
    }
    const arrow = 'hidden h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-sand-200 bg-sand-50 text-ink hover:border-brand-500 sm:flex'
    return (
      <div className="mt-4">
        <div className="mb-2 flex items-center gap-2">
          <p className="flex-1 text-sm font-bold text-sand-700">
            {t('blog.examplesCount', { count: shown.length })}
            {shown.length > 2 && <span className="font-normal"> · {t('blog.examplesScroll')}</span>}
          </p>
          {/* Стрілки — для мишки; на телефоні стрічку гортають пальцем */}
          {shown.length > 2 && (
            <>
              <button type="button" onClick={() => scroll(-1)} aria-label={t('gallery.prev')} className={arrow}>
                <ChevronLeft size={18} strokeWidth={2.5} aria-hidden />
              </button>
              <button type="button" onClick={() => scroll(1)} aria-label={t('gallery.next')} className={arrow}>
                <ChevronRight size={18} strokeWidth={2.5} aria-hidden />
              </button>
            </>
          )}
        </div>
        <ul
          ref={strip}
          className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:thin] sm:mx-0 sm:px-0"
        >
          {shown.map((p, i) => (
            <li key={p.id} className="w-36 shrink-0 snap-start sm:w-44">
              {card(p, i)}
            </li>
          ))}
        </ul>
      </div>
    )
  }

  const grid = (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {shown.map((p, i) => (
        <li key={p.id}>
          {card(p, i)}
        </li>
      ))}
    </ul>
  )

  const more =
    filter.genera?.length === 1 ? `/c/plants?genus=${encodeURIComponent(filter.genera[0])}` : filter.tags?.length === 1 ? `/c/plants?tag=${filter.tags[0]}` : '/c/plants'
  return (
    <section className="mt-10" aria-labelledby="examples-title">
      <h2 id="examples-title" className="flex items-center gap-2 font-display text-2xl font-extrabold text-brand-600">
        <Leaf size={22} strokeWidth={2.25} aria-hidden />
        {t('blog.examples')}
      </h2>
      <p className="mt-1 mb-4 text-sm text-sand-700">{t('blog.examplesHint')}</p>
      {grid}
      <Link to={more} className="group mt-4 inline-flex min-h-11 items-center gap-1.5 font-bold text-brand-600 hover:underline">
        {t('blog.examplesMore')}
        <ArrowRight size={16} strokeWidth={2.4} className="transition-transform group-hover:translate-x-1" aria-hidden />
      </Link>
    </section>
  )
}
