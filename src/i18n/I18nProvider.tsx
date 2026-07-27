import { useMemo, type ReactNode } from 'react'
import { LocalisationContext } from './context'
import { resolveFormattingLocale } from './format'
import { createLocalisation } from './localisation'
import { enMessages } from './messages/en'

export interface I18nProviderProps {
  readonly children: ReactNode
  /**
   * The locale for dates, numbers, and plural selection. Defaults to the
   * browser's preference. There is no language setting: the copy is English
   * until a second catalog is complete, and offering a half-translated
   * language is worse than offering none.
   */
  readonly locale?: string
}

export function I18nProvider({ children, locale }: I18nProviderProps) {
  const resolved = locale ?? resolveFormattingLocale()
  const value = useMemo(
    () => createLocalisation(resolved, enMessages),
    [resolved],
  )
  return (
    <LocalisationContext.Provider value={value}>
      {children}
    </LocalisationContext.Provider>
  )
}
