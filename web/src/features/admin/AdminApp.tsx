import { Navigate, Route, Routes } from 'react-router'
import { PLANT_CATEGORY } from '../../lib/plants'
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

// Цей модуль вантажиться ліниво (див. app/router.tsx) — покупці не завантажують код адмінки.
// Окремого списку товарів в адмінці немає: товари керуються прямо в магазині (кнопки продавця на картках,
// «Вибрати» для масових дій, «Додати» в каталозі). Тут лишились форма товару й решта розділів.
export default function AdminApp() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<AdminHome />} />
        {/* Старі посилання на список товарів — у каталог магазину */}
        <Route path="products" element={<Navigate to={`/c/${PLANT_CATEGORY}`} replace />} />
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
