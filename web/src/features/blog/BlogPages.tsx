import { AlertTriangle, ArrowLeft, ArrowRight, Clock, ExternalLink, ImagePlus, Lightbulb, Search, Trash2 } from 'lucide-react'
import { Fragment, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams, useSearchParams } from 'react-router'
import { ICON } from '../../shared/icon'
import { ImageCropper } from '../../shared/ImageCropper'
import { PageTitle } from '../../shared/ui'
import { ARTICLES, BLOG_CATEGORIES, categoryLabel, findArticle, SOIL_RECIPES, type Article, type BlogCategory, type Block } from './articles'
import { ArticleGrid, Cover } from './ArticleCards'
import { useAuth } from '../auth/authStore'
import { Comments } from './Comments'
import { useArticleCovers, useSetArticleCover } from './covers'
import { FIGURES } from './Illustrations'

const formatDate = (date: string) => new Date(date).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' })

/** У тексті статті: **жирний**, *курсив* (латинські назви родів і видів) */
function Rich({ text }: { text: string }) {
  const parts = text.split(/(\*\*.+?\*\*|\*[^*]+?\*)/g)
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('**') ? (
          <strong key={i} className="font-bold text-ink">
            <Rich text={part.slice(2, -2)} />
          </strong>
        ) : part.startsWith('*') && part.length > 2 ? (
          <em key={i}>{part.slice(1, -1)}</em>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  )
}

/** Колір кожного компонента в рецепті — як у калькуляторі */
const PART_COLORS = ['#8a6a45', '#efe7da', '#b9b3a6', '#e2c48f']

function Meta({ article }: { article: Article }) {
  const { t } = useTranslation()
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-sand-700">
      <span>{formatDate(article.date)}</span>
      <span className="inline-flex items-center gap-1">
        <Clock size={14} strokeWidth={2.25} aria-hidden />
        {t('blog.minutes', { count: article.minutes })}
      </span>
    </p>
  )
}

export function BlogPage() {
  const { t } = useTranslation()
  // Вибраний розділ — в адресі (?cat=care), щоб ним можна було поділитися
  const [params, setParams] = useSearchParams()
  const param = params.get('cat')
  const cat = BLOG_CATEGORIES.some((c) => c.id === param) ? (param as BlogCategory) : null
  const shown = cat ? ARTICLES.filter((a) => a.category === cat) : ARTICLES
  const chip = (on: boolean) =>
    `inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border-2 py-1.5 pr-1.5 pl-4 text-sm font-bold whitespace-nowrap transition-colors ${
      on ? 'border-brand-600 bg-brand-600 text-sand-50' : 'border-sand-200 bg-sand-50 text-ink hover:border-brand-500'
    }`
  const count = (n: number, on: boolean) => (
    <span className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[11px] tabular-nums ${on ? 'bg-brand-700 text-sand-100' : 'bg-sand-200 text-sand-700'}`}>{n}</span>
  )
  return (
    <div>
      <PageTitle>{t('blog.title')}</PageTitle>
      <p className="-mt-2 mb-5 max-w-2xl text-sand-700">{t('blog.intro')}</p>
      {/* На телефоні розділи гортаються вбік одним рядком */}
      <div className="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0" role="group" aria-label={t('blog.categories')}>
        <button type="button" onClick={() => setParams({}, { replace: true })} className={chip(!cat)} aria-pressed={!cat}>
          {t('blog.allCategories')}
          {count(ARTICLES.length, !cat)}
        </button>
        {BLOG_CATEGORIES.map((c) => {
          const on = cat === c.id
          return (
            <button key={c.id} type="button" onClick={() => setParams({ cat: c.id }, { replace: true })} className={chip(on)} aria-pressed={on}>
              {c.label}
              {count(ARTICLES.filter((a) => a.category === c.id).length, on)}
            </button>
          )
        })}
      </div>
      <ArticleGrid articles={shown} />
    </div>
  )
}

function BlockView({ block }: { block: Block }): ReactNode {
  switch (block.type) {
    case 'h2':
      return <h2 className="mt-9 font-display text-2xl font-extrabold text-brand-600">{block.text}</h2>
    case 'p':
      return (
        <p className="mt-4 leading-relaxed">
          <Rich text={block.text} />
        </p>
      )
    case 'ul':
    case 'ol': {
      const List = block.type
      return (
        <List className={`mt-4 space-y-2 pl-6 leading-relaxed ${block.type === 'ul' ? 'list-disc marker:text-sunset-500' : 'list-decimal marker:font-bold marker:text-sunset-600'}`}>
          {block.items.map((item, i) => (
            <li key={i} className="pl-1">
              <Rich text={item} />
            </li>
          ))}
        </List>
      )
    }
    case 'tip':
      return (
        <aside className="mt-6 flex gap-3 rounded-2xl border-2 border-brand-500/30 bg-brand-100/60 p-4 leading-relaxed">
          <Lightbulb size={22} strokeWidth={2.25} className="mt-0.5 shrink-0 text-brand-600" aria-hidden />
          <p>
            <Rich text={block.text} />
          </p>
        </aside>
      )
    case 'recipe': {
      const recipe = SOIL_RECIPES.find((r) => r.id === block.recipe)
      if (!recipe) return null
      return (
        <div className="mt-6 rounded-2xl border-2 border-dashed border-sunset-500/50 bg-sand-50 p-5">
          <p className="font-display text-lg font-extrabold text-sunset-700">{recipe.title}</p>
          <div className="mt-3 flex h-3 overflow-hidden rounded-full" aria-hidden>
            {recipe.parts.map((part, i) => (
              <span key={part.name} style={{ width: `${part.pct}%`, background: PART_COLORS[i] }} />
            ))}
          </div>
          <ul className="mt-3 space-y-1.5">
            {recipe.parts.map((part, i) => (
              <li key={part.name} className="flex items-center gap-2.5">
                <span className="h-3 w-3 shrink-0 rounded-full border border-sand-300" style={{ background: PART_COLORS[i] }} aria-hidden />
                <span className="flex-1">{part.name}</span>
                <span className="font-display font-extrabold text-sunset-600">{part.pct}%</span>
              </li>
            ))}
          </ul>
          {recipe.note && <p className="mt-3 text-sm text-sand-700">{recipe.note}</p>}
        </div>
      )
    }
    case 'warning':
      return (
        <aside className="mt-6 flex gap-3 rounded-2xl border-2 border-sunset-500/40 bg-sunset-100/60 p-4 leading-relaxed">
          <AlertTriangle size={22} strokeWidth={2.25} className="mt-0.5 shrink-0 text-sunset-600" aria-hidden />
          <p>
            <Rich text={block.text} />
          </p>
        </aside>
      )
    case 'shop':
      return (
        <Link
          to={`/search?q=${encodeURIComponent(block.query)}`}
          className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border-2 border-brand-600 px-4 font-bold text-brand-600 hover:bg-brand-600 hover:text-sand-50"
        >
          <Search size={17} strokeWidth={2.25} aria-hidden />
          Знайти <i>{block.query}</i> у нашому магазині
        </Link>
      )
    case 'sources':
      return (
        <aside className="mt-10 border-t-2 border-sand-200 pt-5 text-sm">
          <p className="font-bold text-sand-700">Джерела</p>
          <ul className="mt-2 space-y-1.5">
            {block.items.map((src) => (
              <li key={src.url} className="flex gap-2">
                <ExternalLink size={14} strokeWidth={2.25} className="mt-1 shrink-0 text-sand-700" aria-hidden />
                <a href={src.url} target="_blank" rel="noopener noreferrer" className="break-words text-brand-600 underline decoration-brand-500/40 underline-offset-2 hover:decoration-brand-600">
                  {src.title}
                </a>
              </li>
            ))}
          </ul>
        </aside>
      )
    case 'figure': {
      const Figure = FIGURES[block.id]
      return Figure ? <Figure /> : null
    }
  }
}

export function ArticlePage() {
  const { t } = useTranslation()
  const { slug = '' } = useParams()
  const article = findArticle(slug)
  const isSeller = useAuth((s) => s.role === 'seller')
  const { data: covers } = useArticleCovers()

  if (!article) {
    return (
      <div className="py-8 text-center">
        <PageTitle>{t('blog.notFound')}</PageTitle>
        <Link to="/blog" className="mt-4 inline-block rounded-xl bg-brand-600 px-6 py-3.5 font-bold text-sand-50 hover:bg-brand-700">
          {t('blog.all')}
        </Link>
      </div>
    )
  }

  const others = ARTICLES.filter((a) => a.slug !== article.slug)
    .sort((a, b) => Number(b.category === article.category) - Number(a.category === article.category))
    .slice(0, 3)

  return (
    <div>
      <Link to="/blog" className="group inline-flex min-h-11 items-center gap-1.5 font-bold text-brand-600 hover:underline">
        <ArrowLeft {...ICON} className="transition-transform group-hover:-translate-x-1" />
        {t('blog.title')}
      </Link>
      <article className="mx-auto mt-5 max-w-2xl">
        <Cover icon={article.icon} big cover={covers?.get(article.slug)} />
        {isSeller && <CoverEditor slug={article.slug} hasCover={!!covers?.get(article.slug)} />}
        <Link
          to={`/blog?cat=${article.category}`}
          className="mt-6 inline-block rounded-full bg-sunset-100 px-3 py-1 text-xs font-bold tracking-wider text-sunset-700 uppercase hover:bg-sunset-200"
        >
          {categoryLabel(article.category)}
        </Link>
        <h1 className="mt-3 font-display text-3xl leading-tight font-extrabold text-brand-600 sm:text-4xl">{article.title}</h1>
        <div className="mt-3">
          <Meta article={article} />
        </div>
        <p className="mt-5 text-lg leading-relaxed text-sand-700">{article.excerpt}</p>
        {article.body.map((block, i) => (
          <BlockView key={i} block={block} />
        ))}
        <div className="mt-10 rounded-3xl bg-brand-600 p-6 text-sand-50">
          <p className="font-display text-xl font-extrabold">{t('blog.ctaTitle')}</p>
          <p className="mt-1 text-sm text-sand-100">{t('blog.ctaText')}</p>
          <Link to="/c/plants" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-sand-50 px-5 py-3 font-bold text-brand-700 hover:bg-sand-100">
            {t('home.toCatalog')}
            <ArrowRight size={16} strokeWidth={2.4} aria-hidden />
          </Link>
        </div>
      </article>
      <Comments slug={article.slug} />
      {others.length > 0 && (
        <section className="mt-14">
          <h2 className="mb-5 font-display text-2xl font-extrabold text-brand-600">{t('blog.more')}</h2>
          <ArticleGrid articles={others} />
        </section>
      )}
    </div>
  )
}

/** Продавцю під обкладинкою: додати чи змінити фото-заставку статті й прибрати її. */
function CoverEditor({ slug, hasCover }: { slug: string; hasCover: boolean }) {
  const { t } = useTranslation()
  const save = useSetArticleCover(slug)
  const input = useRef<HTMLInputElement>(null)
  // Вибране фото спершу відкривається в редакторі обрізання (рамка 4:3, як у заставки)
  const [picked, setPicked] = useState<File | null>(null)
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {picked && (
        <ImageCropper
          file={picked}
          aspect={4 / 3}
          onDone={(file) => {
            setPicked(null)
            save.mutate(file)
          }}
          onCancel={() => setPicked(null)}
        />
      )}
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) setPicked(file)
          e.target.value = ''
        }}
      />
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={save.isPending}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-600 px-4 font-bold text-sand-50 transition-transform hover:bg-brand-700 active:scale-[0.97] disabled:opacity-60"
      >
        <ImagePlus {...ICON} />
        {save.isPending ? t('blog.coverUploading') : t(hasCover ? 'blog.coverChange' : 'blog.coverAdd')}
      </button>
      {hasCover && (
        <button
          type="button"
          onClick={() => window.confirm(t('blog.coverRemoveConfirm')) && save.mutate(null)}
          disabled={save.isPending}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border-2 border-red-700/40 px-4 font-bold text-red-700 hover:border-red-700 hover:bg-red-700 hover:text-white disabled:opacity-60"
        >
          <Trash2 {...ICON} />
          {t('blog.coverRemove')}
        </button>
      )}
      <span className="text-sm text-sand-700">{t('blog.coverHint')}</span>
      {save.isError && <p className="w-full text-sm text-red-700">{t('admin.uploadError')}</p>}
    </div>
  )
}
