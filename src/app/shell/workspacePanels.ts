import { createContext, useContext } from 'react'

/** The two regions that can leave the wide layout and return as drawers. */
export type WorkspacePanel = 'navigation' | 'details'

export interface WorkspacePanelsValue {
  /** The panels the current view actually offers. */
  readonly available: readonly WorkspacePanel[]
  /**
   * The panel showing as a drawer, or `null`. At most one: opening one closes
   * the other, so a narrow screen is never covered twice over.
   */
  readonly open: WorkspacePanel | null
  readonly toggle: (panel: WorkspacePanel) => void
  readonly close: () => void
  /** Declared by the workspace, which knows which regions it was given. */
  readonly declareAvailable: (panels: readonly WorkspacePanel[]) => void
}

const NONE: WorkspacePanelsValue = Object.freeze({
  available: Object.freeze([]),
  open: null,
  toggle: () => undefined,
  close: () => undefined,
  declareAvailable: () => undefined,
})

export const WorkspacePanelsContext =
  createContext<WorkspacePanelsValue | null>(null)

/**
 * The shared drawer state. The top bar owns the toggles and the workspace owns
 * the regions, so neither can own the state; a view rendered outside the shell
 * gets an inert value rather than an error.
 */
export function useWorkspacePanels(): WorkspacePanelsValue {
  return useContext(WorkspacePanelsContext) ?? NONE
}
