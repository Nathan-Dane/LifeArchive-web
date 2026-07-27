import { useTranslate } from '../../i18n'
import { nextAppearance, type AppearancePreference } from './appearance'
import { useAppearance } from './appearanceContext'
import { ShellIcon, type ShellIconName } from './ShellIcon'

const ICONS: Record<AppearancePreference, ShellIconName> = {
  system: 'appearance-system',
  light: 'appearance-light',
  dark: 'appearance-dark',
}

const LABELS = {
  system: 'app.appearance.system',
  light: 'app.appearance.light',
  dark: 'app.appearance.dark',
} as const

/**
 * Cycles system → light → dark.
 *
 * The control shows the appearance in force, not the one a click would bring,
 * because the reader is entitled to know which of the three states they are in
 * — "system" and "dark" look identical on a dark desktop otherwise.
 */
export function AppearanceControl() {
  const t = useTranslate()
  const { appearance, setAppearance } = useAppearance()
  const label = t(LABELS[appearance])

  return (
    <button
      type="button"
      className="shell-action"
      onClick={() => setAppearance(nextAppearance(appearance))}
      aria-label={t('app.appearance.action', { appearance: label })}
    >
      <span className="shell-action__icon">
        <ShellIcon name={ICONS[appearance]} />
      </span>
      <span className="shell-action__label ui-text">{label}</span>
    </button>
  )
}
