import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

export function NotFoundPage() {
  const { t } = useTranslation()
  return (
    <div className="space-y-3">
      <h1 className="text-xl font-semibold">{t('notFound.title')}</h1>
      <Link to="/" className="underline">
        {t('common.backHome')}
      </Link>
    </div>
  )
}
