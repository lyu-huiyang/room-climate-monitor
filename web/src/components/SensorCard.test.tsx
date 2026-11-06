import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { SensorCard } from './SensorCard'

it('renders value with unit', () => {
  render(<SensorCard name="sht40" value={{ t: 24.31, h: 52.1 }} color="#2a78d6" />)
  expect(screen.getByText('sht40')).toBeInTheDocument()
  expect(screen.getByText('24.3 °C')).toBeInTheDocument()
  expect(screen.getByText('52.1 %')).toBeInTheDocument()
})

it('renders failure text when sensor missing', () => {
  render(<SensorCard name="aht20" value={null} color="#eb6834" />)
  expect(screen.getByText('读取失败')).toBeInTheDocument()
  expect(screen.queryByText(/°C/)).not.toBeInTheDocument()
})
