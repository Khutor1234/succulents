import { Navigate, Route, Routes } from 'react-router'
import { AdminLayout } from './AdminLayout'
import { CategoriesPage } from './CategoriesPage'
import { AnalyticsPage } from './AnalyticsPage'
import { CustomersPage } from './CustomersPage'
import { ImportPage } from './ImportPage'
import { OrdersPage } from './OrdersPage'
import { ProductFormPage } from './ProductFormPage'
import { ProductsPage } from './ProductsPage'

// Цей модуль вантажиться ліниво (див. app/router.tsx) — покупці не завантажують код адмінки.
export default function AdminApp() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<Navigate to="products" replace />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="import" element={<ImportPage />} />
        <Route path="products/:id" element={<ProductFormPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
      </Route>
    </Routes>
  )
}
