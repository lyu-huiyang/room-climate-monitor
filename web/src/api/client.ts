import createClient, { type FetchResponse } from 'openapi-fetch'
import type { paths } from './schema'

// Derive the aliases from what api.GET returns: openapi-fetch widens tuples such as
// comfort.t from [number, number] to number[], so schema types would not match the data.
type GetData<P extends keyof paths> = NonNullable<FetchResponse<NonNullable<paths[P]['get']>, object, `${string}/${string}`>['data']>

export type RoomOut = GetData<'/api/rooms/{room_id}'>
export type LatestOut = NonNullable<RoomOut['latest']>
export type HistoryOut = GetData<'/api/rooms/{room_id}/history'>
export type HistoryRange = HistoryOut['range']

export const api = createClient<paths>({
  // An absolute base keeps Request construction valid outside the browser (tests).
  baseUrl: globalThis.location?.origin ?? '',
  // Resolve fetch per call so test spies and polyfills take effect.
  fetch: (request) => globalThis.fetch(request),
})
