import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { unwrap } from '../api/http'

export const ROOM_REFRESH_MS = 60_000

export function useRooms() {
  return useQuery({
    queryKey: ['rooms'],
    queryFn: () => unwrap(api.GET('/api/rooms')),
    refetchInterval: ROOM_REFRESH_MS,
  })
}
