import { expect, test } from '@playwright/test'

test('overview lists both rooms and navigates to detail', async ({ page }) => {
  await page.goto('/')
  const living = page.getByRole('link', { name: /客厅/ })
  await expect(living).toBeVisible()
  await expect(page.getByRole('link', { name: /卧室/ })).toBeVisible()
  await expect(living).toContainText('°C')
  await living.click()
  await expect(page).toHaveURL(/\/rooms\/living-room$/)
  await expect(page.getByRole('heading', { level: 1, name: '客厅' })).toBeVisible()
})

test('room page switches range and keeps charts', async ({ page }) => {
  await page.goto('/rooms/living-room')
  await expect(page.locator('section canvas')).toHaveCount(2)
  await page.getByRole('button', { name: '7 天' }).click()
  await expect(page.getByRole('button', { name: '7 天' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page).toHaveURL(/range=7d/)
  await expect(page.locator('section canvas')).toHaveCount(2)
  await expect(page.getByText('这段时间没有数据')).toHaveCount(0)
})

test('language toggle switches to English', async ({ page }) => {
  await page.goto('/rooms/living-room')
  await page.getByRole('button', { name: '切换到英文' }).click()
  await expect(page.getByRole('button', { name: '24 hours' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('heading', { name: /^Temperature/ })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await page.reload()
  await expect(page.getByRole('button', { name: '24 hours' })).toBeVisible()
})

test('unknown route shows not found', async ({ page }) => {
  await page.goto('/no/such/page')
  await expect(page.getByRole('heading', { name: '页面不存在' })).toBeVisible()
  await page.getByRole('link', { name: '返回首页' }).click()
  await expect(page.getByRole('link', { name: /客厅/ })).toBeVisible()
})

test('deep link to a room works via SPA fallback', async ({ page }) => {
  const response = await page.goto('/rooms/bedroom')
  expect(response?.status()).toBe(200)
  await expect(page.getByRole('heading', { level: 1, name: '卧室' })).toBeVisible()
  await expect(page.getByText('sht40')).toBeVisible()
})

test('unknown room shows not found', async ({ page }) => {
  await page.goto('/rooms/no-such-room')
  await expect(page.getByText('房间不存在')).toBeVisible()
})

test('api stays JSON under the SPA fallback', async ({ request }) => {
  const response = await request.get('/api/no-such-endpoint')
  expect(response.status()).toBe(404)
  expect(response.headers()['content-type']).toContain('application/json')
})
