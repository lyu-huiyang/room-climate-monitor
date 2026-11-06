import { useTranslation } from 'react-i18next'
import { Navigate } from 'react-router-dom'
import { RoomCard } from '../components/RoomCard'
import { useNowS } from '../hooks/useNowS'
import { useRooms } from '../hooks/useRooms'

export function OverviewPage() {
  const { t } = useTranslation()
  const rooms = useRooms()
  const nowS = useNowS()

  if (rooms.isPending) return <p className="text-ink-2">{t('common.loading')}</p>
  if (rooms.isError)
    return (
      <div className="space-y-3">
        <p className="text-critical-ink">{t('common.error')}</p>
        <button type="button" onClick={() => void rooms.refetch()} className="rounded-md border border-border px-3 py-1">
          {t('common.retry')}
        </button>
      </div>
    )
  if (rooms.data.length === 0)
    return (
      <div className="space-y-3">
        <h1 className="text-xl font-semibold">{t('overview.emptyTitle')}</h1>
        <p className="text-ink-2">{t('overview.emptyHint')}</p>
        <pre className="overflow-x-auto rounded-lg bg-surface p-3 text-sm">
          <code>{t('overview.emptyCommand')}</code>
        </pre>
      </div>
    )
  if (rooms.data.length === 1) return <Navigate replace to={`/rooms/${rooms.data[0].id}`} />
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {rooms.data.map((room) => (
        <RoomCard key={room.id} room={room} nowS={nowS} />
      ))}
    </div>
  )
}
