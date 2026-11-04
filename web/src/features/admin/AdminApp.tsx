import { Route, Routes } from 'react-router'
import { AdminHome } from './AdminHome'
import { AdminLayout } from './AdminLayout'
import { CategoriesPage } from './CategoriesPage'
import { AnalyticsPage } from './AnalyticsPage'
import { CustomersPage } from './CustomersPage'
import { FormFixesPage } from './FormFixesPage'
import { ImportPage } from './ImportPage'
import { OrdersPage } from './OrdersPage'
import { PedigreesPage } from './PedigreesPage'
import { ProductFormPage } from './ProductFormPage'
import { ProductListPage } from './ProductListPage'

// Цей модуль вантажиться ліниво (див. app/router.tsx) — покупці не завантажують код адмінки.
// Товари керуються і прямо в магазині (кнопки продавця на картках, «Вибрати» для масових дій, «Додати» в каталозі),
// і тут — компактним списком (/admin/products, плитка «Каталог»), щоб бачити багато товарів одразу.
export default function AdminApp() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<AdminHome />} />
        <Route path="products" element={<ProductListPage />} />
        <Route path="products/:id" element={<ProductFormPage />} />
        <Route path="import" element={<ImportPage />} />
        <Route path="forms" element={<FormFixesPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="pedigrees" element={<PedigreesPage />} />
      </Route>
    </Routes>
  )
}
