import { useTranslation } from 'react-i18next'
import { SITE_NS } from './i18n'

/** Shown on the full-screen demo only; inside the landing page's phone frame the page labels it. */
export function DemoBanner() {
  const { t } = useTranslation(SITE_NS)
  if (window.self !== window.top) return null
  return (
    <div className="bg-warning/15 px-4 py-2 text-center text-sm text-warning-ink">
      {t('demo.banner')} ·{' '}
      <a href="../" target="_top" className="underline">
        {t('demo.back')}
      </a>
    </div>
  )
}
