import { QueryClient } from '@tanstack/react-query'
import { isNotFound } from './api/http'

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        // A missing room will not appear by retrying.
        retry: (failureCount, error) => !isNotFound(error) && failureCount < 3,
      },
    },
  })
}
