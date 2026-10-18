import { ArticleGrid } from './ArticleCards'
import { ARTICLES } from './articles'

/** Три свіжі статті на головній. Окремий модуль — тексти статей вантажаться вже після основного вмісту сторінки. */
export default function HomeArticles() {
  return <ArticleGrid articles={ARTICLES.slice(0, 3)} />
}
