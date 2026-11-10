import type { i18n as I18n } from 'i18next'
import { LANGUAGES, type Language } from '../../src/i18n'

// The language detector stores a manual choice under this key (src/i18n/index.ts).
const STORAGE_KEY = 'rcm.lang'

const isLanguage = (value: string | null): value is Language => LANGUAGES.some((l) => l === value)

/**
 * The landing page and the demo in its phone frame are separate documents on one origin:
 * a language picked in one reaches the other through the storage event.
 */
export function syncLanguageAcrossFrames(i18n: I18n): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY && isLanguage(event.newValue)) void i18n.changeLanguage(event.newValue)
  }
  window.addEventListener('storage', onStorage)
  return () => window.removeEventListener('storage', onStorage)
}
