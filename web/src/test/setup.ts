import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import i18n from '../i18n'

// Charts render to canvas, which jsdom lacks; components only need the API surface.
vi.mock('echarts/core', () => ({
  use: vi.fn(),
  init: vi.fn(() => ({ setOption: vi.fn(), resize: vi.fn(), dispose: vi.fn() })),
}))

beforeEach(async () => {
  await i18n.changeLanguage('zh-CN')
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})
