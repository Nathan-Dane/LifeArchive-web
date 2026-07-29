import type { ReactNode } from 'react'
import { useTranslate } from '../../i18n'
import { AppearanceControl } from './AppearanceControl'
import { ShellIcon, type ShellIconName } from './ShellIcon'
import { useWorkspacePanels, type WorkspacePanel } from './workspacePanels'

const PANEL_LABELS = {
  navigation: 'app.panel.navigation',
  details: 'app.panel.details',
} as const

const PANEL_ICONS: Record<WorkspacePanel, ShellIconName> = {
  navigation: 'navigation',
  details: 'details',
}

/** Toggles one workspace region while it is a drawer. */
function PanelToggle({ panel }: { readonly panel: WorkspacePanel }) {
  const t = useTranslate()
  const { open, toggle } = useWorkspacePanels()

  return (
    <button
      type="button"
      className={`shell-action shell-action--panel shell-action--${panel}`}
      aria-expanded={open === panel}
      aria-controls={`workspace-${panel}`}
      onClick={() => toggle(panel)}
    >
      <span className="shell-action__icon">
        <ShellIcon name={PANEL_ICONS[panel]} />
      </span>
      <span className="shell-action__label ui-text">
        {t(PANEL_LABELS[panel])}
      </span>
    </button>
  )
}

export interface ShellHeaderProps {
  /** The application's main navigation, when the current state has one. */
  readonly navigation?: ReactNode
}

/**
 * The top bar: what this application is, where you are in it, and the controls
 * that belong to the window rather than to a record.
 *
 * The name is a span, not a heading. Each view keeps its own single `h1`, and a
 * permanent heading above it would make every screen reader outline start with
 * the same word.
 */
export function ShellHeader({ navigation }: ShellHeaderProps) {
  const t = useTranslate()
  const { available } = useWorkspacePanels()

  return (
    <header className="shell-header">
      <div className="shell-brand">
        <span className="shell-brand__name">{t('app.name')}</span>
        {navigation ? (
          <span className="shell-brand__local">{t('app.archive.local')}</span>
        ) : null}
      </div>
      {navigation}
      <div className="shell-actions">
        {available.includes('navigation') ? (
          <PanelToggle panel="navigation" />
        ) : null}
        {available.includes('details') ? <PanelToggle panel="details" /> : null}
        <AppearanceControl />
      </div>
    </header>
  )
}
