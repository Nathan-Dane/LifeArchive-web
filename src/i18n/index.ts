/**
 * The localisation surface. Components import from here and never from a
 * message file directly.
 */

export type {
  DynamicValues,
  MessageArgs,
  MessageCatalog,
  MessageEntry,
  MessageKey,
  MessageValues,
  PluralCategory,
  PluralMessage,
} from './catalog'
export { isPluralMessage, mergeCatalogs } from './catalog'
export {
  createFormatters,
  resolveFormattingLocale,
  type DateStyle,
  type Formatters,
  type WeekdayStyle,
} from './format'
export {
  createLocalisation,
  MissingMessageError,
  MissingMessageValueError,
  type Localisation,
  type Translator,
} from './localisation'
export {
  defaultLocalisation,
  LocalisationContext,
  resetDefaultLocalisation,
  useFormat,
  useLocalisation,
  useTranslate,
  type AppLocalisation,
} from './context'
export { I18nProvider, type I18nProviderProps } from './I18nProvider'
export { CATALOG_LOCALE, enMessages, type Messages } from './messages/en'
export {
  failureMessage,
  failureMessageKeys,
  hasFailureMessage,
} from './failureMessages'
export {
  semanticName,
  semanticNameKey,
  type SemanticKind,
  type SemanticName,
} from './semanticNames'
