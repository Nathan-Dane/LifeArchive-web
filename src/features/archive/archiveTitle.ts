import type { ArchiveIdentity } from '../../core/client'
import type { useTranslate } from '../../i18n'

/** Resolves the one localized archive title used across archive surfaces. */
export function archiveTitle(
  identity: ArchiveIdentity,
  t: ReturnType<typeof useTranslate>,
): string {
  const title = identity.title?.trim()
  if (title) return title

  const subject =
    identity.subject.displayName?.trim() || identity.subject.shortName?.trim()

  return subject
    ? t('settings.archive.title.subject', { name: subject })
    : t('settings.archive.title.fallback')
}
