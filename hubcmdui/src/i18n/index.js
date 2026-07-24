/**
 * 国际化（i18n）基础设施
 * - 支持语言：简体中文(zh-CN) / 繁體中文(zh-TW) / English(en)
 * - 语言选择持久化到 localStorage，首次访问按浏览器语言自动匹配
 * - 同时维护 Element Plus 内置文案的语言映射（分页 / 日期选择器 / 上传等）
 */
import { createI18n } from 'vue-i18n'
import zhCN from './locales/zh-CN'
import en from './locales/en'
import zhTW from './locales/zh-TW'

// Element Plus 内置文案语言包
import elZhCN from 'element-plus/es/locale/lang/zh-cn'
import elEn from 'element-plus/es/locale/lang/en'
import elZhTW from 'element-plus/es/locale/lang/zh-tw'

export const SUPPORTED_LOCALES = [
  { code: 'zh-CN', label: '简体中文', el: 'zh-cn' },
  { code: 'zh-TW', label: '繁體中文', el: 'zh-tw' },
  { code: 'en', label: 'English', el: 'en' }
]

export const EL_LOCALES = {
  'zh-CN': elZhCN,
  'zh-TW': elZhTW,
  en: elEn
}

const STORAGE_KEY = 'hubcmdui.lang'

function detectDefault() {
  if (typeof navigator === 'undefined') return 'zh-CN'
  const lang = (navigator.language || 'zh-CN').toLowerCase()
  if (lang.startsWith('zh')) {
    return lang.includes('tw') || lang.includes('hk') || lang.includes('hant')
      ? 'zh-TW'
      : 'zh-CN'
  }
  if (lang.startsWith('en')) return 'en'
  return 'zh-CN'
}

function loadLocale() {
  if (typeof localStorage === 'undefined') return detectDefault()
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved && SUPPORTED_LOCALES.some((s) => s.code === saved)) return saved
  return detectDefault()
}

export function persistLocale(code) {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, code)
  }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = code
  }
}

export function getElLocale(code) {
  return EL_LOCALES[code] || EL_LOCALES['zh-CN']
}

const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: loadLocale(),
  fallbackLocale: 'zh-CN',
  missingWarn: false,
  silentTranslationWarn: true,
  messages: {
    'zh-CN': zhCN,
    'zh-TW': zhTW,
    en
  }
})

export default i18n
