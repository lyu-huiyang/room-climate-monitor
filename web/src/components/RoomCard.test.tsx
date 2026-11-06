import { screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { makeRoom, NOW_S, renderWithProviders } from '../test/render'
import { RoomCard } from './RoomCard'

it('shows average of valid sensors and online dot', () => {
  renderWithProviders(<RoomCard room={makeRoom()} nowS={NOW_S} />)
  expect(screen.getByText('客厅')).toBeInTheDocument()
  expect(screen.getByText('24.4 °C')).toBeInTheDocument()
  expect(screen.getByText('51.5 %')).toBeInTheDocument()
  expect(screen.getByText('42 秒前')).toBeInTheDocument()
  expect(screen.getByRole('img', { name: '在线' })).toHaveClass('bg-good')
  expect(screen.getByRole('link')).toHaveAttribute('href', '/rooms/living-room')
})

it('shows offline when latest is null', () => {
  renderWithProviders(<RoomCard room={makeRoom({ latest: null })} nowS={NOW_S} />)
  expect(screen.getByText('暂无数据')).toBeInTheDocument()
  expect(screen.getByRole('img', { name: '已离线' })).toHaveClass('bg-critical')
  expect(screen.queryByText(/°C/)).not.toBeInTheDocument()
})

it('shows offline when age exceeds 300 s', () => {
  const room = makeRoom()
  renderWithProviders(<RoomCard room={room} nowS={room.latest!.ts + 301} />)
  expect(screen.getByText('已离线')).toBeInTheDocument()
  expect(screen.getByRole('img', { name: '已离线' })).toHaveClass('bg-critical')
})

it('shows disagreement badge when sensors differ', () => {
  const room = makeRoom()
  room.latest!.sensors = { sht40: { t: 24, h: 50 }, aht20: { t: 25.5, h: 50 } }
  renderWithProviders(<RoomCard room={room} nowS={NOW_S} />)
  expect(screen.getByRole('img', { name: '传感器读数不一致' })).toHaveTextContent('⚠')
})

it('shows agreement check when sensors agree', () => {
  renderWithProviders(<RoomCard room={makeRoom()} nowS={NOW_S} />)
  expect(screen.getByRole('img', { name: '传感器读数一致' })).toHaveTextContent('✓')
})
