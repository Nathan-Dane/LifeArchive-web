import { useTranslate } from '../../i18n'
import { DevelopmentMockBanner } from '../mock/DevelopmentMockBanner'

/**
 * The composed application's development banner.
 *
 * Its wording comes from the catalog, like every other visible string.
 */
export function DevelopmentModeNotice() {
  const t = useTranslate()
  return <DevelopmentMockBanner notice={t('development.mock.notice')} />
}
