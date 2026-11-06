import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { unwrap } from '../api/http'
import { ROOM_REFRESH_MS } from './useRooms'

export function useRoom(roomId: string) {
  return useQuery({
    queryKey: ['room', roomId],
    queryFn: () => unwrap(api.GET('/api/rooms/{room_id}', { params: { path: { room_id: roomId } } })),
    refetchInterval: ROOM_REFRESH_MS,
  })
}
