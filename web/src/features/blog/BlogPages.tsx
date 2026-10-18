import { AlertTriangle, ArrowLeft, ArrowRight, Clock, Lightbulb, Search } from 'lucide-react'
import { Fragment, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { ICON } from '../../shared/icon'
import { PageTitle } from '../../shared/ui'
import { ARTICLES, findArticle, SOIL_RECIPES, type Article, type Block } from './articles'
import { ArticleGrid, Cover } from './ArticleCards'
import { Comments } from './Comments'
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
  return (
    <div>
      <PageTitle>{t('blog.title')}</PageTitle>
      <p className="-mt-2 mb-6 max-w-2xl text-sand-700">{t('blog.intro')}</p>
      <ArticleGrid articles={ARTICLES} />
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

  const others = ARTICLES.filter((a) => a.slug !== article.slug).slice(0, 3)

  return (
    <div>
      <Link to="/blog" className="group inline-flex items-center gap-1.5 font-bold text-brand-600 hover:underline">
        <ArrowLeft {...ICON} className="transition-transform group-hover:-translate-x-1" />
        {t('blog.title')}
      </Link>
      <article className="mx-auto mt-5 max-w-2xl">
        <Cover icon={article.icon} big />
        <h1 className="mt-6 font-display text-3xl leading-tight font-extrabold text-brand-600 sm:text-4xl">{article.title}</h1>
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
