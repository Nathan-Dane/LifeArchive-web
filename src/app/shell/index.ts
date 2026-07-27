/**
 * The application shell: the window, its regions, and the preferences that
 * belong to the window rather than to an archive.
 */

export { AppFrame, type AppFrameProps } from './AppFrame'
export { AppearanceControl } from './AppearanceControl'
export {
  AppearanceProvider,
  type AppearanceProviderProps,
} from './AppearanceProvider'
export {
  APPEARANCE_ATTRIBUTE,
  APPEARANCE_PREFERENCES,
  APPEARANCE_STORAGE_KEY,
  DEFAULT_APPEARANCE,
  appearanceStorage,
  applyAppearance,
  isAppearancePreference,
  nextAppearance,
  readStoredAppearance,
  storeAppearance,
  type AppearancePreference,
} from './appearance'
export { useAppearance, type AppearanceValue } from './appearanceContext'
export { ShellHeader, type ShellHeaderProps } from './ShellHeader'
export { ShellIcon, type ShellIconName } from './ShellIcon'
export {
  StatusScreen,
  type StatusAction,
  type StatusScreenProps,
} from './StatusScreen'
export { WorkspaceLayout, type WorkspaceLayoutProps } from './WorkspaceLayout'
export {
  useWorkspacePanels,
  type WorkspacePanel,
  type WorkspacePanelsValue,
} from './workspacePanels'
