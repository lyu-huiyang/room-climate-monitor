import { useEffect, useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import { LanguageToggle } from '../../src/components/LanguageToggle'
import { SITE_NS } from './i18n'

const REPO = 'https://github.com/lyu-huiyang/room-climate-monitor'
const DEMO = 'demo/'
// Tailwind's md breakpoint: below it a phone frame inside a phone makes no sense.
const WIDE = '(min-width: 768px)'

function subscribe(onChange: () => void) {
  const media = window.matchMedia?.(WIDE)
  media?.addEventListener('change', onChange)
  return () => media?.removeEventListener('change', onChange)
}

function useWideScreen(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia?.(WIDE).matches ?? false,
    () => false,
  )
}

function PhoneFrame() {
  const { t } = useTranslation(SITE_NS)
  return (
    <figure className="flex flex-col items-center gap-2">
      <figcaption className="text-sm text-warning-ink">{t('demo.label')}</figcaption>
      <div className="h-[min(680px,calc(100dvh-8rem))] w-[340px] overflow-hidden rounded-[2.5rem] border-[10px] border-ink/85 bg-page shadow-xl">
        <iframe src={DEMO} title={t('demo.frameTitle')} className="h-full w-full" />
      </div>
      <a href={DEMO} className="text-sm underline">
        {t('demo.fullscreen')}
      </a>
    </figure>
  )
}

const STEPS = ['step1', 'step2', 'step3'] as const

export function Landing() {
  const { t } = useTranslation(SITE_NS)
  const wide = useWideScreen()
  useEffect(() => {
    document.title = t('meta.title')
  }, [t])

  return (
    <div className="min-h-dvh bg-page text-ink">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <span className="font-semibold">Room Climate</span>
        <LanguageToggle />
      </header>

      <main className="mx-auto max-w-5xl space-y-16 px-4 pb-16">
        <section className="grid items-start gap-10 md:grid-cols-[1fr_auto]">
          <div className="space-y-5">
            <h1 className="text-3xl leading-tight font-semibold md:text-4xl">{t('hero.title')}</h1>
            <p className="text-ink-2">{t('hero.tagline')}</p>
            <div className="flex flex-wrap gap-3">
              {!wide && (
                <a href={DEMO} className="rounded-md bg-ink px-4 py-2 text-page">
                  {t('demo.open')}
                </a>
              )}
              <a href="#deploy" className="rounded-md border border-border px-4 py-2">
                {t('hero.deploy')}
              </a>
              <a href={REPO} className="rounded-md border border-border px-4 py-2">
                {t('hero.github')}
              </a>
            </div>
          </div>
          {wide && <PhoneFrame />}
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t('hardware.title')}</h2>
          <p className="text-ink-2">{t('hardware.intro')}</p>
          <ul className="list-disc space-y-1 pl-6">
            <li>{t('hardware.board')}</li>
            <li>{t('hardware.sht40')}</li>
            <li>{t('hardware.aht20')}</li>
          </ul>
          <a href={t('hardware.moreHref')} className="text-sm underline">
            {t('hardware.more')}
          </a>
        </section>

        <section id="deploy" className="space-y-6">
          <h2 className="text-xl font-semibold">{t('deploy.title')}</h2>
          <ol className="space-y-6">
            {STEPS.map((step, i) => (
              <li key={step} className="space-y-2 rounded-lg border border-border bg-surface p-4">
                <h3 className="font-semibold">
                  {i + 1}. {t(`deploy.${step}.title`)}
                </h3>
                <p className="text-ink-2">{t(`deploy.${step}.text`)}</p>
                <pre className="overflow-x-auto rounded-md bg-band p-3 text-sm">
                  <code>{t(`deploy.${step}.code`)}</code>
                </pre>
                <a href={t(`deploy.${step}.href`)} className="text-sm underline">
                  {t(`deploy.${step}.more`)} →
                </a>
              </li>
            ))}
          </ol>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t('why.title')}</h2>
          <ul className="list-disc space-y-1 pl-6 text-ink-2">
            <li>{t('why.home')}</li>
            <li>{t('why.noCloud')}</li>
            <li>{t('why.oneFile')}</li>
          </ul>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-ink-2">
          <span>
            <a href={REPO} className="underline">
              {t('footer.github')}
            </a>{' '}
            ·{' '}
            <a href={`${REPO}/blob/main/LICENSE`} className="underline">
              {t('footer.license')}
            </a>
          </span>
          <LanguageToggle />
        </div>
      </footer>
    </div>
  )
}
