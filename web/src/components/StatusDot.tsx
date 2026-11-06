import { useTranslation } from 'react-i18next'

export function StatusDot({ online }: { online: boolean }) {
  const { t } = useTranslation()
  return (
    <span
      role="img"
      aria-label={t(online ? 'status.online' : 'status.offline')}
      className={`inline-block size-2.5 shrink-0 rounded-full ${online ? 'bg-good' : 'bg-critical'}`}
    />
  )
}
