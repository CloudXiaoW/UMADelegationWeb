import { createI18n } from 'vue-i18n'
import en from './locales/en.json'
import zh from './locales/zh.json'

export type MessageSchema = typeof en

export const i18n = createI18n<[MessageSchema], 'en' | 'zh'>({
  legacy: false,
  globalInjection: true,
  locale: 'en',
  fallbackLocale: 'en',
  messages: {
    en,
    zh,
  },
})

export function setLocale(locale: 'en' | 'zh'): void {
  const g = i18n.global as { locale: unknown }
  const loc = g.locale
  if (loc && typeof loc === 'object' && 'value' in loc) {
    ;(loc as { value: 'en' | 'zh' }).value = locale
  } else {
    g.locale = locale
  }
  document.documentElement.lang = locale === 'zh' ? 'zh-Hans' : 'en'
}
