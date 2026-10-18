import type React from 'react'
import { createBrowserRouter, Navigate } from 'react-router'
import { AdminRoute } from '../features/admin/AdminRoute'
import { RequireSignIn } from '../features/auth/RequireRole'
import { CartPage } from '../features/cart/CartPage'
import { CategoryPage, HomePage, ProductPage } from '../features/catalog/pages'
import { ErrorPage } from './ErrorPage'
import { Layout } from './Layout'

// Рідкісні сторінки вантажимо окремо, лише коли їх відкривають — так головна й каталог відкриваються швидше.
const lazyPage = (load: () => Promise<{ default: React.ComponentType }>) => () => load().then((m) => ({ Component: m.default }))

export const router = createBrowserRouter([
  {
    element: <Layout />,
    // Будь-яка помилка рендера → зрозуміла сторінка «щось пішло не так» + звіт у Sentry
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'c/:category', element: <CategoryPage /> },
      { path: 'product/:slug', element: <ProductPage /> },
      { path: 'blog', lazy: lazyPage(() => import('../features/blog/BlogPages').then((m) => ({ default: m.BlogPage }))) },
      { path: 'blog/:slug', lazy: lazyPage(() => import('../features/blog/BlogPages').then((m) => ({ default: m.ArticlePage }))) },
      { path: 'search', lazy: lazyPage(() => import('../features/catalog/SearchPage').then((m) => ({ default: m.SearchPage }))) },
      { path: 'cart', element: <CartPage /> },
      // Улюблене живе в кабінеті; стара адреса веде туди
      { path: 'favorites', element: <Navigate to="/account/favorites" replace /> },
      { path: 'checkout', lazy: lazyPage(() => import('../features/checkout/CheckoutPage').then((m) => ({ default: m.CheckoutPage }))) },
      { path: 'order/success/:number', lazy: lazyPage(() => import('../features/checkout/OrderSuccessPage').then((m) => ({ default: m.OrderSuccessPage }))) },
      { path: 'login', lazy: lazyPage(() => import('../features/auth/LoginPage').then((m) => ({ default: m.LoginPage }))) },
      {
        path: 'account',
        lazy: lazyPage(() =>
          import('../features/account/AccountPage').then(({ AccountPage }) => ({
            default: () => (
              <RequireSignIn>
                <AccountPage />
              </RequireSignIn>
            ),
          })),
        ),
      },
      {
        path: 'account/favorites',
        lazy: lazyPage(() =>
          import('../features/favorites/FavoritesPage').then(({ FavoritesPage }) => ({
            default: () => (
              <RequireSignIn>
                <FavoritesPage />
              </RequireSignIn>
            ),
          })),
        ),
      },
      {
        path: 'account/orders',
        lazy: lazyPage(() =>
          import('../features/account/OrdersPage').then(({ OrdersPage }) => ({
            default: () => (
              <RequireSignIn>
                <OrdersPage />
              </RequireSignIn>
            ),
          })),
        ),
      },
      { path: 'admin/*', element: <AdminRoute /> },
      // Невідома адреса → та сама сторінка, але з текстом «не знайдено»
      { path: '*', loader: () => { throw new Response('Not found', { status: 404 }) } },
    ],
  },
])
