import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './i18n'
import { createQueryClient } from './queryClient'
import { Root } from './Root'
import './styles/index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root queryClient={createQueryClient()} />
  </StrictMode>,
)
