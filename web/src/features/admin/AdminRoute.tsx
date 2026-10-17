import { lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { RequireRole } from '../auth/RequireRole'

// Код адмінки — окремий файл, який вантажиться тільки продавцю.
const AdminApp = lazy(() => import('./AdminApp'))

export function AdminRoute() {
  const { t } = useTranslation()
  return (
    <RequireRole role="seller">
      <Suspense fallback={<p className="text-sand-700">{t('loading')}</p>}>
        <AdminApp />
      </Suspense>
    </RequireRole>
  )
}
