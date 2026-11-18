import { Navigate, Route, Routes, useSearchParams } from 'react-router'
import { AdminHome } from './AdminHome'
import { AdminLayout } from './AdminLayout'
import { AnalyticsPage } from './AnalyticsPage'
import { CustomersPage } from './CustomersPage'
import { FormFixesPage } from './FormFixesPage'
import { OrdersPage } from './OrdersPage'
import { ProductFormPage } from './ProductFormPage'
import { ProductListPage } from './ProductListPage'

/**
 * Колишня окрема сторінка стала вкладкою іншого розділу — стара адреса (закладка, історія браузера) веде туди.
 * `keep` — під яким параметром нова сторінка чекає вкладку, що була в старій адресі (?tab=…).
 */
function Moved({ to, keep, fallback }: { to: string; keep?: string; fallback?: string }) {
  const [params] = useSearchParams()
  const old = params.get('tab') ?? fallback
  const url = new URL(to, 'http://x')
  if (keep && old) url.searchParams.set(keep, old)
  return <Navigate to={url.pathname + url.search} replace />
}

// Цей модуль вантажиться ліниво (див. app/router.tsx) — покупці не завантажують код адмінки.
// Розділи: Замовлення, Товари (з вкладкою «Категорії»), Покупці, Аналітика (з «Родоводами»), Інструменти (імпорт і виправлення).
// Товари керуються і прямо в магазині (кнопки продавця на картках, «Вибрати» для масових дій, «Додати» в каталозі).
export default function AdminApp() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<AdminHome />} />
        <Route path="products" element={<ProductListPage />} />
        <Route path="products/:id" element={<ProductFormPage />} />
        <Route path="tools" element={<FormFixesPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        {/* Старі адреси */}
        <Route path="categories" element={<Moved to="/admin/products?tab=categories" />} />
        <Route path="pedigrees" element={<Moved to="/admin/analytics?tab=pedigrees" keep="view" />} />
        <Route path="import" element={<Moved to="/admin/tools" />} />
        <Route path="forms" element={<Moved to="/admin/tools" keep="tab" fallback="forms" />} />
        <Route path="origins" element={<Moved to="/admin/tools?tab=origins" />} />
      </Route>
    </Routes>
  )
}
