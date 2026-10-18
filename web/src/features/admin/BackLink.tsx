import { ArrowLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { ICON } from '../../shared/icon'

const CLASS = 'group mb-3 inline-flex min-h-11 items-center gap-1.5 font-bold text-brand-600 hover:underline'

/**
 * «← Назад» над окремими сторінками адмінки (імпорт, виправлення форм): повертає туди, звідки прийшли.
 * Якщо сторінку відкрили напряму (нема куди «назад») — веде на `fallback`.
 */
export function BackLink({ fallback = '/admin/products' }: { fallback?: string }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  // react-router рахує переходи всередині сайту: idx > 0 — є попередня сторінка сайту
  const canGoBack = (window.history.state?.idx ?? 0) > 0
  const content = (
    <>
      <ArrowLeft {...ICON} className="transition-transform group-hover:-translate-x-1" />
      {t('admin.back')}
    </>
  )
  return canGoBack ? (
    <button type="button" onClick={() => navigate(-1)} className={CLASS}>
      {content}
    </button>
  ) : (
    <Link to={fallback} className={CLASS}>
      {content}
    </Link>
  )
}
