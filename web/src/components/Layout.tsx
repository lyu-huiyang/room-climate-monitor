import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Outlet } from 'react-router-dom'
import { LanguageToggle } from './LanguageToggle'

export function Layout() {
  const { t } = useTranslation()
  useEffect(() => {
    document.title = t('app.title')
  }, [t])
  return (
    <div className="min-h-dvh bg-page text-ink">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link to="/" className="font-semibold">
          {t('app.title')}
        </Link>
        <LanguageToggle />
      </header>
      <main className="mx-auto max-w-5xl px-4 pb-10">
        <Outlet />
      </main>
    </div>
  )
}
