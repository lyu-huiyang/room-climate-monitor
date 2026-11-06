import { useTranslation } from 'react-i18next'
import { agreement, type SensorReadings } from '../lib/agreement'
import { formatValue } from '../lib/format'

export function AgreementBadge({ sensors }: { sensors: SensorReadings }) {
  const { t } = useTranslation()
  const result = agreement(sensors)
  if (!result) return null
  return (
    <p className="text-sm">
      <span className={result.ok ? 'text-good-ink' : 'text-warning-ink'}>{t(result.ok ? 'agreement.ok' : 'agreement.bad')}</span>
      <span className="text-ink-2">
        {' · '}
        {t('agreement.detail', { dt: formatValue(result.dt, 2), dh: formatValue(result.dh, 1) })}
      </span>
    </p>
  )
}
