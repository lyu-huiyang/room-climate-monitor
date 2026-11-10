import { render, screen, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import './i18n'
import { Landing } from './Landing'

function screenWidth(wide: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: wide,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
}

it('renders the hero, the frame and the deploy steps', () => {
  screenWidth(true)
  render(<Landing />)
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('家里每个房间的温度和湿度，一眼看全')
  const frame = screen.getByTitle('Room Climate 演示')
  expect(frame.tagName).toBe('IFRAME')
  expect(frame.getAttribute('src')).toMatch(/demo\/$/)
  expect(screen.getByText('演示数据')).toBeInTheDocument()
  const deploy = document.getElementById('deploy')!
  expect(within(deploy).getByText(/sudo chown 10001:10001 data/)).toBeInTheDocument()
  expect(within(deploy).getByText(/rcm room add living-room --name 客厅/)).toBeInTheDocument()
  expect(within(deploy).getByText(/pio run -e supermini -t upload/)).toBeInTheDocument()
  // Step 1 ends in deploy/; the firmware commands need firmware/.
  expect(within(deploy).getByText(/cd \.\.\/firmware/)).toBeInTheDocument()
  // The server listens on 127.0.0.1 only until the LAN line in compose.yaml is enabled.
  expect(within(deploy).getByText(/compose\.yaml/)).toBeInTheDocument()
  expect(within(deploy).getByText(/SERVER_URL/)).toBeInTheDocument()
})

it('phone visitors get a button instead of a frame', () => {
  screenWidth(false)
  render(<Landing />)
  expect(screen.queryByTitle('Room Climate 演示')).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: '打开 demo' })).toHaveAttribute('href', 'demo/')
})

it('has no price', () => {
  screenWidth(true)
  render(<Landing />)
  expect(document.body.textContent).not.toMatch(/[¥$]|元/)
})
