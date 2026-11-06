import { useTranslation } from 'react-i18next'
import type { HistoryRange } from '../api/client'
import { RANGES } from '../lib/ranges'

export function RangeTabs({ value, onChange }: { value: HistoryRange; onChange: (range: HistoryRange) => void }) {
  const { t } = useTranslation()
  return (
    <div role="group" aria-label={t('range.label')} className="inline-flex rounded-lg border border-border p-0.5">
      {RANGES.map((range) => (
        <button
          key={range}
          type="button"
          aria-pressed={value === range}
          onClick={() => onChange(range)}
          className={`rounded-md px-3 py-1 text-sm ${value === range ? 'bg-ink text-page' : 'text-ink-2 hover:text-ink'}`}
        >
          {t(`range.${range}`)}
        </button>
      ))}
    </div>
  )
}
