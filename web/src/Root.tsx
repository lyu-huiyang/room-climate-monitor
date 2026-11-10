import { type QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, HashRouter } from 'react-router-dom'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'

type RootProps = {
  queryClient: QueryClient
  /** The demo site uses hash routing so a reload never hits a missing static path. */
  router?: 'browser' | 'hash'
}

export function Root({ queryClient, router = 'browser' }: RootProps) {
  const Router = router === 'hash' ? HashRouter : BrowserRouter
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <Router>
          <App />
        </Router>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
