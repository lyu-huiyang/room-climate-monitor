import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'
import en from './en.json'
import zhCN from './zh-CN.json'

export const LANGUAGES = ['zh-CN', 'en'] as const
export type Language = (typeof LANGUAGES)[number]

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { 'zh-CN': { translation: zhCN }, en: { translation: en } },
    supportedLngs: [...LANGUAGES],
    fallbackLng: 'en',
    initAsync: false,
    interpolation: { escapeValue: false },
    detection: {
      // A manual choice (stored by the detector, which guards storage access) wins over the browser language.
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'rcm.lang',
      convertDetectedLanguage: (lng: string) => (lng.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en'),
    },
  })

const syncHtmlLang = (lng: string) => {
  document.documentElement.lang = lng
}
syncHtmlLang(i18n.resolvedLanguage ?? 'en')
i18n.on('languageChanged', syncHtmlLang)

export default i18n
