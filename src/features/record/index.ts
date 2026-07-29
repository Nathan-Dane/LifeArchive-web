/**
 * Record. One destination — a scale, a civil location, and either the ordinary
 * entry or one exact object ID — presented across the three workspace regions.
 */

export { civilLocation } from './civilLocation'
export { RecordPage } from './RecordPage'
export {
  RecordDestinationProvider,
  RecordDetailsRegion,
  RecordNavigationRegion,
  type RecordDestinationProviderProps,
} from './RecordWorkspace'
export {
  RecordDestinationContext,
  useRecordDestination,
  type RecordDestination,
} from './recordDestination'
export { type Tracks, type TracksState } from './tracks'
export {
  RECORD_CURSOR_STORAGE_KEY,
  resetRememberedRecordCursor,
} from './navigation'
