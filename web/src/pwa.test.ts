import { expect, it } from 'vitest'
import { pwaOptions } from '../pwa.config'

it('never answers API navigations with the app shell', () => {
  const deny = pwaOptions.workbox?.navigateFallbackDenylist ?? []
  expect(deny.some((r) => r.test('/api/health'))).toBe(true)
  expect(deny.some((r) => r.test('/rooms/living-room'))).toBe(false)
})

it('fetches every API request from the network', () => {
  const [rule] = pwaOptions.workbox?.runtimeCaching ?? []
  expect(rule.handler).toBe('NetworkOnly')
  const matches = rule.urlPattern as (o: { url: URL }) => boolean
  expect(matches({ url: new URL('https://climate.example/api/rooms') })).toBe(true)
  expect(matches({ url: new URL('https://climate.example/rooms/api') })).toBe(false)
})

it('describes an installable app', () => {
  const manifest = pwaOptions.manifest
  expect(manifest && manifest.display).toBe('standalone')
  expect(manifest && manifest.icons?.map((i) => i.sizes)).toEqual(['192x192', '512x512', '512x512'])
})
