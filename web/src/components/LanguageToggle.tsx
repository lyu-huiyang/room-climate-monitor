import { useTranslation } from 'react-i18next'

export function LanguageToggle() {
  const { t, i18n } = useTranslation()
  const next = i18n.resolvedLanguage === 'zh-CN' ? 'en' : 'zh-CN'
  return (
    <button
      type="button"
      onClick={() => void i18n.changeLanguage(next)}
      aria-label={t('lang.switch')}
      className="rounded-md border border-border px-2 py-1 text-sm text-ink-2 hover:text-ink"
    >
      {next === 'en' ? 'EN' : '中文'}
    </button>
  )
}
