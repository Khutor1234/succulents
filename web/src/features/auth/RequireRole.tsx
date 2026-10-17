import type { ReactNode } from 'react'
import { Navigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useAuth, type Role } from './authStore'

/** Сторінка лише для залогінених (кабінет). */
export function RequireSignIn({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const { user, loading } = useAuth()
  if (loading) return <p className="p-6">{t('loading')}</p>
  if (!user) return <Navigate to="/login" replace />
  return children
}

/** Тільки для UX: справжній захист — у Security Rules і Cloud Functions. */
export function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { t } = useTranslation()
  const { user, role: current, loading } = useAuth()

  if (loading) return <p className="p-6">{t('loading')}</p>
  if (!user) return <Navigate to="/login" replace />
  if (current !== role) return <Navigate to="/" replace />
  return children
}
