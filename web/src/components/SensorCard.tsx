import { useTranslation } from 'react-i18next'
import { formatValue } from '../lib/format'

interface Props {
  name: string
  value: { t: number; h: number } | null
  color: string
}

export function SensorCard({ name, value, color }: Props) {
  const { t } = useTranslation()
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center gap-2 text-sm text-ink-2">
        <span className="inline-block size-2.5 rounded-full" style={{ background: color }} />
        <span>{name}</span>
      </div>
      {value ? (
        <div className="mt-2 flex flex-wrap items-baseline gap-x-3 tabular-nums">
          <span className="whitespace-nowrap text-xl font-semibold sm:text-2xl">{`${formatValue(value.t)} °C`}</span>
          <span className="whitespace-nowrap text-ink-2">{`${formatValue(value.h)} %`}</span>
        </div>
      ) : (
        <p className="mt-2 text-critical-ink">{t('sensor.failed')}</p>
      )}
    </div>
  )
}
