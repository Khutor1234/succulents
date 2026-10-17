import { createBrowserRouter } from 'react-router'
import { AccountPage } from '../features/account/AccountPage'
import { AdminRoute } from '../features/admin/AdminRoute'
import { LoginPage } from '../features/auth/LoginPage'
import { RequireSignIn } from '../features/auth/RequireRole'
import { CartPage } from '../features/cart/CartPage'
import { CategoryPage, HomePage, ProductPage } from '../features/catalog/pages'
import { SearchPage } from '../features/catalog/SearchPage'
import { CheckoutPage } from '../features/checkout/CheckoutPage'
import { OrderSuccessPage } from '../features/checkout/OrderSuccessPage'
import { ErrorPage } from './ErrorPage'
import { Layout } from './Layout'

export const router = createBrowserRouter([
  {
    element: <Layout />,
    // Будь-яка помилка рендера → зрозуміла сторінка «щось пішло не так» + звіт у Sentry
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'c/:category', element: <CategoryPage /> },
      { path: 'product/:slug', element: <ProductPage /> },
      { path: 'search', element: <SearchPage /> },
      { path: 'cart', element: <CartPage /> },
      { path: 'checkout', element: <CheckoutPage /> },
      { path: 'order/success/:number', element: <OrderSuccessPage /> },
      { path: 'login', element: <LoginPage /> },
      {
        path: 'account',
        element: (
          <RequireSignIn>
            <AccountPage />
          </RequireSignIn>
        ),
      },
      { path: 'admin/*', element: <AdminRoute /> },
      // Невідома адреса → та сама сторінка, але з текстом «не знайдено»
      { path: '*', loader: () => { throw new Response('Not found', { status: 404 }) } },
    ],
  },
])
