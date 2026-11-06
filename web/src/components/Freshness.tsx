import { useTranslation } from 'react-i18next'
import { freshness } from '../lib/freshness'

/** "42 秒前", red "已离线", or "暂无数据", next to a status dot. */
export function Freshness({ ts, nowS, className = '' }: { ts: number | null; nowS: number; className?: string }) {
  const { t } = useTranslation()
  const { ageS, online } = freshness(ts, nowS)
  let text: string
  if (ageS === null) text = t('room.noData')
  else if (online) text = t('room.ago', { count: ageS })
  else text = t('room.offline')
  return <span className={`${online ? 'text-ink-2' : 'text-critical-ink'} ${className}`}>{text}</span>
}
