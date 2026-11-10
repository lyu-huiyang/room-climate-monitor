import { expect, test } from '@playwright/test'

const ROOMS = ['卧室', '客厅', '书房', '阳台']

test('landing shows the live demo in a phone frame', async ({ page, isMobile }) => {
  test.skip(isMobile, 'wide screens only')
  await page.goto('./')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('家里每个房间的温度和湿度，一眼看全')
  const demo = page.frameLocator('iframe[title="Room Climate 演示"]')
  for (const name of ROOMS) await expect(demo.getByText(name, { exact: true })).toBeVisible()
  await expect(demo.getByText('已离线')).toBeVisible()
})

test('phone visitors get a button instead of a frame', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phones only')
  await page.goto('./')
  await expect(page.locator('iframe')).toHaveCount(0)
  await page.getByRole('link', { name: '打开 demo' }).click()
  await expect(page).toHaveURL(/\/demo\/$/)
  for (const name of ROOMS) await expect(page.getByText(name, { exact: true })).toBeVisible()
})

test('full-screen demo opens a room and survives a reload', async ({ page }) => {
  await page.goto('demo/')
  await expect(page.getByText('演示模式 · 数据为模拟')).toBeVisible()
  await page.getByText('卧室', { exact: true }).click()
  await expect(page).toHaveURL(/#\/rooms\/bedroom$/)
  await expect(page.locator('canvas').first()).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: '卧室' })).toBeVisible()
  await expect(page.locator('canvas').first()).toBeVisible()
})

test('unknown room shows not found', async ({ page }) => {
  await page.goto('demo/#/rooms/nope')
  await expect(page.getByText('房间不存在')).toBeVisible()
})

test('switching language updates the framed demo at once', async ({ page, isMobile }) => {
  test.skip(isMobile, 'wide screens only')
  await page.goto('./')
  const demo = page.frameLocator('iframe[title="Room Climate 演示"]')
  await expect(demo.getByText('卧室', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '切换到英文' }).first().click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Temperature and humidity of every room at home, at a glance',
  )
  // Without the language-change refetch the names would wait for the next minute.
  await expect(page.frameLocator('iframe[title="Room Climate demo"]').getByText('Bedroom', { exact: true })).toBeVisible({
    timeout: 3_000,
  })
})

test('readings refresh every minute', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-10T12:00:30Z') })
  await page.goto('demo/#/rooms/living-room')
  const age = page.getByText(/^\d+ 秒前$/).first()
  await expect(age).toHaveText('30 秒前')
  await page.clock.fastForward('01:05')
  // A fresh fetch reports the 12:01 reading (35 s old); a stale one would say 95 s.
  await expect(age).toHaveText('35 秒前')
})

test('no service worker and no manifest', async ({ page }) => {
  await page.goto('demo/')
  await expect(page.getByText('卧室', { exact: true })).toBeVisible()
  // A string keeps DOM types out of the Node-side tsconfig.
  expect(await page.evaluate('navigator.serviceWorker.getRegistrations().then((r) => r.length)')).toBe(0)
  expect((await page.request.get('demo/sw.js')).status()).toBe(404)
  expect((await page.request.get('sw.js')).status()).toBe(404)
  expect((await page.request.get('manifest.webmanifest')).status()).toBe(404)
})

test('short laptop screens see the whole first screen', async ({ page, isMobile }) => {
  test.skip(isMobile, 'wide screens only')
  await page.setViewportSize({ width: 1366, height: 650 })
  await page.goto('./')
  await expect(page.getByRole('heading', { level: 1 })).toBeInViewport()
  await expect(page.getByRole('link', { name: '全屏打开 demo' })).toBeInViewport({ ratio: 1 })
})
