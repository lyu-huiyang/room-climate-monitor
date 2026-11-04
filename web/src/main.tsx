import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './i18n'
import './styles/index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <main className="mx-auto max-w-3xl p-4">
      <h1 className="text-xl font-semibold">Room Climate</h1>
    </main>
  </StrictMode>,
)
