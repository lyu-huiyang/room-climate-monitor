import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createQueryClient } from '../../src/queryClient'
import { Root } from '../../src/Root'
import { installMockApi } from '../src/demo/mockApi'
import { DemoBanner } from '../src/DemoBanner'
import i18n from '../src/i18n'
import { syncLanguageAcrossFrames } from '../src/syncLanguage'
import '../src/site.css'

installMockApi(() => (i18n.resolvedLanguage === 'zh-CN' ? 'zh-CN' : 'en'))

const queryClient = createQueryClient()
// Room names follow the language; refetch at once instead of on the next minute.
i18n.on('languageChanged', () => void queryClient.invalidateQueries())
syncLanguageAcrossFrames(i18n)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DemoBanner />
    <Root queryClient={queryClient} router="hash" />
  </StrictMode>,
)
