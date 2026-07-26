import { useTranslate } from '../../i18n'
import { DevelopmentMockBanner } from '../mock/DevelopmentMockBanner'

/**
 * The composed application's development banner.
 *
 * The banner itself keeps a self-contained default so the mock stays readable
 * on its own; the wording the application shows comes from the catalog, like
 * every other visible string.
 */
export function DevelopmentModeNotice() {
  const t = useTranslate()
  return <DevelopmentMockBanner notice={t('development.mock.notice')} />
}
