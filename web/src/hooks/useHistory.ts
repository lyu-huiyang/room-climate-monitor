import { useQuery } from '@tanstack/react-query'
import { api, type HistoryRange } from '../api/client'
import { unwrap } from '../api/http'

export const HISTORY_REFRESH_MS = 300_000

export function useHistory(roomId: string, range: HistoryRange) {
  return useQuery({
    queryKey: ['history', roomId, range],
    queryFn: () =>
      unwrap(api.GET('/api/rooms/{room_id}/history', { params: { path: { room_id: roomId }, query: { range } } })),
    refetchInterval: HISTORY_REFRESH_MS,
    // Keep the previous range on screen while the new one loads, but never another room's curves.
    placeholderData: (previous, previousQuery) => (previousQuery?.queryKey[1] === roomId ? previous : undefined),
  })
}
