// Site copy lives in its own namespace on the app's i18n instance, so the shared
// LanguageToggle and the language detector work unchanged.
import i18n from '../../../src/i18n'
import en from './en.json'
import zhCN from './zh-CN.json'

export const SITE_NS = 'site'

i18n.addResourceBundle('en', SITE_NS, en)
i18n.addResourceBundle('zh-CN', SITE_NS, zhCN)

export default i18n
