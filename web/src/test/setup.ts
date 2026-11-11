import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import i18n from '../i18n'

// Charts render to canvas, which jsdom lacks; components only need the API surface.
vi.mock('echarts/core', () => ({
  use: vi.fn(),
  init: vi.fn(() => ({ setOption: vi.fn(), resize: vi.fn(), dispose: vi.fn() })),
}))

// findBy* waits 1 s by default, too little for the lazily loaded chart chunk on a busy CI
// runner. Stay below Vitest's 5 s test timeout so a real miss still fails with a clear error.
configure({ asyncUtilTimeout: 3000 })

beforeEach(async () => {
  await i18n.changeLanguage('zh-CN')
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})
