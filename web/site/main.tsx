import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import i18n from './src/i18n'
import { Landing } from './src/Landing'
import { syncLanguageAcrossFrames } from './src/syncLanguage'
import './src/site.css'

syncLanguageAcrossFrames(i18n)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Landing />
  </StrictMode>,
)
