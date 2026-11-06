import { LineChart } from 'echarts/charts'
import { GridComponent, LegendComponent, MarkAreaComponent, TooltipComponent } from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { formatValue } from '../lib/format'
import type { ClimateSeries } from '../lib/series'

echarts.use([LineChart, GridComponent, LegendComponent, MarkAreaComponent, TooltipComponent, CanvasRenderer])

interface Props {
  kind: 'temp' | 'hum'
  series: ClimateSeries
  /** [min, max] of the comfort band. */
  comfort: readonly number[]
  colors: Record<string, string>
  dark: boolean
}

const cssVar = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()

export function ClimateChart({ kind, series, comfort, colors, dark }: Props) {
  const { t } = useTranslation()
  const el = useRef<HTMLDivElement>(null)
  const chart = useRef<ReturnType<typeof echarts.init> | null>(null)
  const unit = kind === 'temp' ? '°C' : '%'
  const data = series[kind]
  const empty = series.sensors.every((name) => (data[name] ?? []).length === 0)

  useEffect(() => {
    const node = el.current
    if (!node) return
    const instance = echarts.init(node)
    chart.current = instance
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => instance.resize())
    observer?.observe(node)
    return () => {
      observer?.disconnect()
      instance.dispose()
      chart.current = null
    }
  }, [])

  useEffect(() => {
    // Theme colors come from the CSS variables, re-read whenever dark mode flips.
    const muted = cssVar('--color-muted') || '#6f6d68'
    const grid = cssVar('--color-grid') || '#e1e0d9'
    const axis = cssVar('--color-axis') || '#c3c2b7'
    const band = cssVar('--color-band') || 'rgba(11, 11, 11, 0.05)'
    const surface = cssVar('--color-surface') || '#fcfcfb'
    const ink = cssVar('--color-ink') || '#0b0b0b'
    chart.current?.setOption(
      {
        animation: false,
        grid: { left: 8, right: 12, top: 32, bottom: 8, containLabel: true },
        legend: { top: 0, left: 0, icon: 'roundRect', itemWidth: 10, itemHeight: 4, textStyle: { color: muted } },
        tooltip: {
          trigger: 'axis',
          backgroundColor: surface,
          borderColor: axis,
          textStyle: { color: ink },
          valueFormatter: (v: unknown) => `${formatValue(typeof v === 'number' ? v : null)} ${unit}`,
        },
        xAxis: {
          type: 'time',
          splitNumber: 3,
          axisLine: { lineStyle: { color: axis } },
          axisLabel: {
            color: muted,
            hideOverlap: true,
            // Language-neutral labels: day boundaries as M/d, everything finer as HH:mm.
            formatter: { year: '{yyyy}', month: '{M}/{d}', day: '{M}/{d}', hour: '{HH}:{mm}', minute: '{HH}:{mm}' },
          },
          splitLine: { show: false },
        },
        yAxis: {
          type: 'value',
          scale: true,
          axisLabel: { color: muted, formatter: (v: number) => `${v}` },
          splitLine: { lineStyle: { color: grid } },
        },
        series: series.sensors.map((name, i) => ({
          name,
          type: 'line',
          showSymbol: false,
          connectNulls: false,
          color: colors[name],
          lineStyle: { width: 1.5 },
          data: data[name] ?? [],
          ...(i === 0 && {
            markArea: {
              silent: true,
              itemStyle: { color: band },
              data: [[{ yAxis: comfort[0], name: t('chart.comfort') }, { yAxis: comfort[1] }]],
              label: { show: false },
            },
          }),
        })),
      },
      { notMerge: true },
    )
  }, [series, data, comfort, colors, dark, unit, t])

  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <h2 className="mb-2 text-sm font-medium text-ink-2">
        {t(kind === 'temp' ? 'chart.temperature' : 'chart.humidity')}
        {' '}
        <span className="text-muted">{unit}</span>
      </h2>
      <div className="relative">
        <div ref={el} className="h-56 w-full" />
        {empty && (
          <p className="absolute inset-0 grid place-items-center text-sm text-muted">{t('chart.empty')}</p>
        )}
      </div>
    </section>
  )
}
