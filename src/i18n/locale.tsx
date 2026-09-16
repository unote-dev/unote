/* eslint-disable react-refresh/only-export-components */
import type { ReactNode } from 'react'
import type { Locale, MessageKey } from '@/i18n/messages'
import { createContext, use, useCallback, useEffect, useMemo, useState } from 'react'
import { messages } from '@/i18n/messages'

interface LocaleContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

function readStoredLocale(): Locale {
  try {
    const stored = localStorage.getItem('locale')
    if (stored === 'en' || stored === 'zh')
      return stored
  }
  catch {
    // ignore missing storage
  }
  return 'zh'
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(readStoredLocale)
  useEffect(() => {
    localStorage.setItem('locale', locale)
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en'
  }, [locale])
  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale])
  return <LocaleContext value={value}>{children}</LocaleContext>
}

export function useI18n() {
  const context = use(LocaleContext)
  const locale = context?.locale ?? 'zh'
  const setLocale = context?.setLocale ?? (() => undefined)
  const t = useCallback((key: MessageKey, vars?: Record<string, string | number>) => {
    let text: string = messages[locale][key]
    if (vars) {
      for (const [name, value] of Object.entries(vars))
        text = text.replaceAll(`{${name}}`, String(value))
    }
    return text
  }, [locale])
  return { locale, setLocale, t }
}
