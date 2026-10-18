import {
  ArrowRight,
  Award,
  Bug,
  Combine,
  Droplets,
  FlaskConical,
  Leaf,
  Palette,
  Shovel,
  Snowflake,
  Sparkles,
  Sun,
  ThermometerSun,
  Type,
  type LucideIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import type { Article, ArticleIcon } from './articles'

// Картки статей окремо від сторінки статті: головна показує їх, не завантажуючи важкі ілюстрації.

/** Кожна тема — свій значок і тепле тло, як у карток товарів. */
const COVERS: Record<ArticleIcon, { icon: LucideIcon; tint: string }> = {
  soil: { icon: Shovel, tint: 'bg-sand-300/70 text-sunset-700' },
  water: { icon: Droplets, tint: 'bg-brand-100 text-brand-600' },
  sun: { icon: Sun, tint: 'bg-sunset-100 text-sunset-600' },
  color: { icon: Palette, tint: 'bg-sunset-100 text-sunset-700' },
  leaf: { icon: Leaf, tint: 'bg-brand-100 text-brand-700' },
  winter: { icon: Snowflake, tint: 'bg-sand-200 text-brand-600' },
  pests: { icon: Bug, tint: 'bg-sunset-200/70 text-sunset-700' },
  forms: { icon: Sparkles, tint: 'bg-sunset-100 text-sunset-600' },
  names: { icon: Type, tint: 'bg-brand-100 text-brand-600' },
  breeders: { icon: Award, tint: 'bg-sand-300/70 text-sunset-700' },
  summer: { icon: ThermometerSun, tint: 'bg-sunset-100 text-sunset-700' },
  fertilizer: { icon: FlaskConical, tint: 'bg-brand-100 text-brand-700' },
  hybrids: { icon: Combine, tint: 'bg-sand-300/70 text-brand-700' },
}


export function Cover({ icon, big }: { icon: ArticleIcon; big?: boolean }) {
  const { icon: Icon, tint } = COVERS[icon]
  return (
    <div className={`flex items-center justify-center rounded-2xl ${tint} ${big ? 'h-40 sm:h-52' : 'aspect-[16/9]'}`}>
      <Icon size={big ? 64 : 44} strokeWidth={1.6} aria-hidden />
    </div>
  )
}


/** Картка статті — у списку блогу й на головній. */
export function ArticleCard({ article }: { article: Article }) {
  const { t } = useTranslation()
  return (
    <Link
      to={`/blog/${article.slug}`}
      className="group flex flex-col rounded-3xl border-2 border-sand-200 bg-sand-50 p-3 transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-1 hover:border-sand-300 hover:shadow-[0_12px_30px_-12px_rgba(43,33,24,0.25)]"
    >
      <Cover icon={article.icon} />
      <div className="mx-1.5 mt-3 flex flex-1 flex-col">
        <h3 className="font-display text-lg leading-snug font-extrabold group-hover:text-brand-600">{article.title}</h3>
        <p className="mt-1.5 flex-1 text-sm leading-relaxed text-sand-700">{article.excerpt}</p>
        <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-brand-600">
          {t('blog.read')}
          <ArrowRight size={16} strokeWidth={2.4} className="transition-transform group-hover:translate-x-1" aria-hidden />
        </span>
      </div>
    </Link>
  )
}

export function ArticleGrid({ articles }: { articles: Article[] }) {
  return (
    <div className="grid gap-5 min-[480px]:grid-cols-2 lg:grid-cols-3">
      {articles.map((a) => (
        <ArticleCard key={a.slug} article={a} />
      ))}
    </div>
  )
}

