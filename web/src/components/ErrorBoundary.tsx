import { Component, type ErrorInfo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

type Props = { children: ReactNode; onReload?: () => void }

/**
 * Turns a render crash into a reload prompt. The usual cause is a page left open across an upgrade:
 * its lazy chunks no longer exist on the server, and without this React unmounts everything.
 */
export class ErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return <CrashNotice onReload={this.props.onReload ?? (() => window.location.reload())} />
  }
}

function CrashNotice({ onReload }: { onReload: () => void }) {
  const { t } = useTranslation()
  return (
    <div role="alert" className="space-y-3 py-4">
      <p className="text-lg font-semibold">{t('crash.title')}</p>
      <p className="text-ink-2">{t('crash.hint')}</p>
      <button type="button" onClick={onReload} className="rounded-md border border-border px-3 py-1">
        {t('crash.reload')}
      </button>
    </div>
  )
}
