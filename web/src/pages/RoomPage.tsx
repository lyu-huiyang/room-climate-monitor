import { lazy, Suspense, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { isNotFound } from '../api/http'
import { AgreementBadge } from '../components/AgreementBadge'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { Freshness } from '../components/Freshness'
import { RangeTabs } from '../components/RangeTabs'
import { SensorCard } from '../components/SensorCard'
import { StatusDot } from '../components/StatusDot'
import { useDarkMode } from '../hooks/useDarkMode'
import { useHistory } from '../hooks/useHistory'
import { useNowS } from '../hooks/useNowS'
import { useRoom } from '../hooks/useRoom'
import { useRooms } from '../hooks/useRooms'
import { sensorColor } from '../lib/colors'
import { freshness } from '../lib/freshness'
import { DEFAULT_RANGE, parseRange } from '../lib/ranges'
import { historyToSeries } from '../lib/series'

// ECharts is most of the bundle; load it only when a room page needs it.
const ClimateChart = lazy(() => import('../components/ClimateChart').then((m) => ({ default: m.ClimateChart })))

export function RoomPage() {
  const { t } = useTranslation()
  const { roomId = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const range = parseRange(params.get('range'))
  const room = useRoom(roomId)
  const rooms = useRooms()
  const history = useHistory(roomId, range)
  const dark = useDarkMode()
  const nowS = useNowS()

  const latestSensors = useMemo(() => room.data?.latest?.sensors ?? {}, [room.data])
  const names = useMemo(
    () => [...new Set([...(history.data?.sensors ?? []), ...Object.keys(latestSensors)])].sort(),
    [history.data, latestSensors],
  )
  // One color per sensor name, shared by the cards and both charts.
  const colors = useMemo(() => Object.fromEntries(names.map((n, i) => [n, sensorColor(i, dark)])), [names, dark])
  const series = useMemo(() => (history.data ? historyToSeries(history.data) : null), [history.data])

  if (room.isPending) return <p className="text-ink-2">{t('common.loading')}</p>
  if (room.isError) {
    if (isNotFound(room.error))
      return (
        <div className="space-y-3">
          <p>{t('room.notFound')}</p>
          <Link to="/" className="underline">
            {t('common.backHome')}
          </Link>
        </div>
      )
    return (
      <div className="space-y-3">
        <p className="text-critical-ink">{t('common.error')}</p>
        <button type="button" onClick={() => void room.refetch()} className="rounded-md border border-border px-3 py-1">
          {t('common.retry')}
        </button>
      </div>
    )
  }

  const latest = room.data.latest
  const comfort = room.data.comfort
  return (
    <div className="space-y-4">
      <div>
        {/* With one room the overview opens it directly, so a link back would bounce here. */}
        {(rooms.data?.length ?? 0) > 1 && (
          <Link to="/" className="mb-2 inline-flex items-center gap-1 py-1 text-sm text-ink-2 hover:text-ink">
            <span aria-hidden="true">‹</span>
            {t('room.allRooms')}
          </Link>
        )}
        <h1 className="text-2xl font-semibold">{room.data.name}</h1>
        <div className="mt-1 flex items-center gap-2 text-sm">
          <StatusDot online={freshness(latest?.ts ?? null, nowS).online} />
          <Freshness ts={latest?.ts ?? null} nowS={nowS} />
          {latest?.rssi != null && <span className="text-muted">· {t('room.rssi', { rssi: latest.rssi })}</span>}
        </div>
      </div>

      {names.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {names.map((name) => (
            <SensorCard key={name} name={name} value={latestSensors[name] ?? null} color={colors[name]} />
          ))}
        </div>
      ) : (
        <p className="text-ink-2">{t('room.noData')}</p>
      )}

      <AgreementBadge sensors={latestSensors} />

      <RangeTabs
        value={range}
        onChange={(next) => setParams(next === DEFAULT_RANGE ? {} : { range: next }, { replace: true })}
      />

      {series ? (
        // A chart chunk that fails to load (e.g. after an upgrade) replaces only the charts.
        <ErrorBoundary>
          <Suspense fallback={<p className="text-ink-2">{t('common.loading')}</p>}>
            <div className="grid gap-3 lg:grid-cols-2">
              <ClimateChart kind="temp" series={series} comfort={comfort.t} colors={colors} dark={dark} />
              <ClimateChart kind="hum" series={series} comfort={comfort.h} colors={colors} dark={dark} />
            </div>
          </Suspense>
        </ErrorBoundary>
      ) : history.isError ? (
        <div className="space-y-3">
          <p className="text-critical-ink">{t('room.historyError')}</p>
          <button
            type="button"
            onClick={() => void history.refetch()}
            className="rounded-md border border-border px-3 py-1"
          >
            {t('common.retry')}
          </button>
        </div>
      ) : (
        <p className="text-ink-2">{t('common.loading')}</p>
      )}
    </div>
  )
}
