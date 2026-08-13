/**
 * Record's time navigation. The panel presents one temporal cursor; the cursor
 * itself and the device facts are exported for the Record surfaces that share
 * that cursor with it, and for the tests.
 */

export {
  RecordNavigationPanel,
  type RecordNavigationPanelProps,
} from './RecordNavigationPanel'
export {
  RECORD_CURSOR_STORAGE_KEY,
  resetRememberedRecordCursor,
  useTemporalCursor,
  type TemporalCursor,
  type TemporalCursorOptions,
  type TemporalCursorState,
  type TemporalDestination,
  type TemporalStatus,
  type TemporalView,
} from './temporalCursor'
