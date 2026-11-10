import type { i18n as I18n } from 'i18next'
import { afterEach, expect, it, vi } from 'vitest'
import { installMockApi } from './demo/mockApi'
import { syncLanguageAcrossFrames } from './syncLanguage'

const fakeI18n = () => ({ changeLanguage: vi.fn() }) as unknown as I18n & { changeLanguage: ReturnType<typeof vi.fn> }
const store = (key: string, newValue: string | null) => window.dispatchEvent(new StorageEvent('storage', { key, newValue }))

const cleanups: (() => void)[] = []
afterEach(() => cleanups.splice(0).forEach((stop) => stop()))

it('follows a language stored by the other frame', () => {
  const i18n = fakeI18n()
  cleanups.push(syncLanguageAcrossFrames(i18n))
  store('rcm.lang', 'en')
  expect(i18n.changeLanguage).toHaveBeenCalledWith('en')
})

it('ignores other keys and unsupported values', () => {
  const i18n = fakeI18n()
  cleanups.push(syncLanguageAcrossFrames(i18n))
  store('other', 'en')
  store('rcm.lang', 'fr')
  store('rcm.lang', null)
  expect(i18n.changeLanguage).not.toHaveBeenCalled()
})

it('stops after unsubscribe', () => {
  const i18n = fakeI18n()
  syncLanguageAcrossFrames(i18n)()
  store('rcm.lang', 'en')
  expect(i18n.changeLanguage).not.toHaveBeenCalled()
})

it('works without localStorage', async () => {
  // Private windows can make every storage access throw.
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('blocked')
  })
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('blocked')
  })
  const realFetch = globalThis.fetch
  cleanups.push(() => {
    globalThis.fetch = realFetch
  })
  expect(() => cleanups.push(syncLanguageAcrossFrames(fakeI18n()))).not.toThrow()
  cleanups.push(installMockApi(() => 'zh-CN'))
  expect(await (await fetch('https://example.test/api/rooms')).json()).toHaveLength(4)
})
