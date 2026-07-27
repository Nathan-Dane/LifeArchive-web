/**
 * The React seam for localisation.
 *
 * The context has no provider requirement. A component that renders without
 * `I18nProvider` — a class error boundary caught mid-tree, a component under
 * test — still gets the complete English catalog rather than throwing or
 * rendering nothing. With one complete locale that is exactly right; when a
 * second locale ships, the provider is what changes, and every consumer here
 * follows it without being touched.
 */

import { createContext, useContext } from 'react'
import { resolveFormattingLocale } from './format'
import { createLocalisation, type Localisation } from './localisation'
import { enMessages, type Messages } from './messages/en'

export type AppLocalisation = Localisation<Messages>

let fallback: AppLocalisation | null = null

/**
 * The localisation used when no provider is above the consumer. Built on first
 * use so that reading the browser's locale is not an import side effect.
 */
export function defaultLocalisation(): AppLocalisation {
  fallback ??= createLocalisation(resolveFormattingLocale(), enMessages)
  return fallback
}

/** Test seam: forget the cached fallback so a new locale is read. */
export function resetDefaultLocalisation(): void {
  fallback = null
}

export const LocalisationContext = createContext<AppLocalisation | null>(null)

export function useLocalisation(): AppLocalisation {
  return useContext(LocalisationContext) ?? defaultLocalisation()
}

/** The catalog lookup used by components. */
export function useTranslate(): AppLocalisation['t'] {
  return useLocalisation().t
}

/** The locale-aware date and number formatters. */
export function useFormat(): AppLocalisation['format'] {
  return useLocalisation().format
}
