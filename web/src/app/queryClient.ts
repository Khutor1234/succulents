import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { reportError } from '../lib/monitoring'

// Один спільний клієнт: його використовує і React (QueryClientProvider), і код поза компонентами (authStore).
// Кожне невдале читання чи збереження (каталог, адмінка, кабінет) автоматично потрапляє в Sentry.
export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => reportError(error, { action: 'query', key: JSON.stringify(query.queryKey) }),
  }),
  mutationCache: new MutationCache({
    onError: (error, _vars, _ctx, mutation) =>
      reportError(error, { action: 'mutation', key: JSON.stringify(mutation.options.mutationKey ?? 'unnamed') }),
  }),
  // Товари змінюються рідко — не перечитуємо Firestore частіше, ніж раз на 5 хв.
  defaultOptions: { queries: { staleTime: 5 * 60 * 1000, retry: 1 } },
})
