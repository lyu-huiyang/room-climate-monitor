import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import type { RoomOut } from '../api/client'
import { agreement, sensorAverage } from '../lib/agreement'
import { formatValue } from '../lib/format'
import { freshness } from '../lib/freshness'
import { Freshness } from './Freshness'
import { StatusDot } from './StatusDot'

export function RoomCard({ room, nowS }: { room: RoomOut; nowS: number }) {
  const { t } = useTranslation()
  const sensors = room.latest?.sensors ?? {}
  const avg = sensorAverage(sensors)
  const agree = agreement(sensors)
  const { online } = freshness(room.latest?.ts ?? null, nowS)
  return (
    <Link
      to={`/rooms/${room.id}`}
      className="block rounded-xl border border-border bg-surface p-4 transition-colors hover:border-ink-2"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="truncate text-base font-medium">{room.name}</h2>
        <StatusDot online={online} />
      </div>
      {avg && (
        <div className="mt-3 flex flex-wrap items-baseline gap-x-3 tabular-nums">
          <span className="whitespace-nowrap text-3xl font-semibold">{`${formatValue(avg.t)} °C`}</span>
          <span className="whitespace-nowrap text-lg text-ink-2">{`${formatValue(avg.h)} %`}</span>
        </div>
      )}
      <div className="mt-2 flex items-center justify-between text-sm">
        <Freshness ts={room.latest?.ts ?? null} nowS={nowS} />
        {agree && (
          <span
            role="img"
            title={t(agree.ok ? 'agreement.okShort' : 'agreement.badShort')}
            aria-label={t(agree.ok ? 'agreement.okShort' : 'agreement.badShort')}
            className={agree.ok ? 'text-good-ink' : 'text-warning-ink'}
          >
            {agree.ok ? '✓' : '⚠'}
          </span>
        )}
      </div>
    </Link>
  )
}
