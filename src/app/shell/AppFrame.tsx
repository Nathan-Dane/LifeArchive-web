import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { ShellHeader } from './ShellHeader'
import {
  WorkspacePanelsContext,
  type WorkspacePanel,
  type WorkspacePanelsValue,
} from './workspacePanels'

function sameMembers(
  a: readonly WorkspacePanel[],
  b: readonly WorkspacePanel[],
): boolean {
  return a.length === b.length && a.every((panel, index) => panel === b[index])
}

export interface AppFrameProps {
  readonly children: ReactNode
  /** Main navigation, shown only in the states that may reach a feature. */
  readonly navigation?: ReactNode
}

/**
 * The window: one top bar over one body region, in every application state.
 *
 * Every state renders inside the frame, including the ones that cannot show a
 * feature. A reader whose runtime is unavailable still gets an application
 * rather than an unstyled paragraph, and still gets the appearance control —
 * but the frame is given no navigation in those states, so the shell cannot
 * offer a route into an editor that has nothing behind it.
 *
 * Drawer state lives here because the toggles are in the top bar and the
 * regions are in the workspace below it.
 */
export function AppFrame({ children, navigation }: AppFrameProps) {
  const [available, setAvailable] = useState<readonly WorkspacePanel[]>([])
  const [requested, setRequested] = useState<WorkspacePanel | null>(null)

  const declareAvailable = useCallback((panels: readonly WorkspacePanel[]) => {
    setAvailable((current) => (sameMembers(current, panels) ? current : panels))
  }, [])

  const toggle = useCallback((panel: WorkspacePanel) => {
    setRequested((current) => (current === panel ? null : panel))
  }, [])

  const close = useCallback(() => setRequested(null), [])

  /* A region the current view no longer offers cannot stay open behind it. */
  const open = requested && available.includes(requested) ? requested : null

  const panels = useMemo<WorkspacePanelsValue>(
    () => ({ available, open, toggle, close, declareAvailable }),
    [available, open, toggle, close, declareAvailable],
  )

  return (
    <WorkspacePanelsContext.Provider value={panels}>
      <div className="shell">
        <ShellHeader navigation={navigation} />
        <div className="shell-body">{children}</div>
      </div>
    </WorkspacePanelsContext.Provider>
  )
}
