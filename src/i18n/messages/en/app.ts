/**
 * Application shell copy: navigation, availability states, and the actions
 * offered when the application cannot show a feature.
 *
 * Every phrase here has to survive being read out of context by a screen
 * reader, and none of it may claim that anything was kept, opened, or made
 * durable. There is no runtime yet, and a status screen that overstates what
 * happened is a data-safety defect rather than a wording preference.
 */
export const appMessages = {
  'app.name': 'LifeArchive',

  'app.navigation.main': 'Main',
  'app.navigation.record': 'Record',
  'app.navigation.timeline': 'Timeline',
  'app.navigation.settings': 'Settings',

  'app.action.retry': 'Try again',
  'app.action.reload': 'Reload application',
  'app.action.closePanel': 'Close {panel}',

  /**
   * The two flanking workspace regions, named both as regions and as the
   * controls that reveal them while they are drawers.
   */
  'app.panel.navigation': 'Navigation',
  'app.panel.details': 'Details',

  /**
   * Appearance. The control shows the appearance in force, so its label is a
   * state and its accessible name says which setting that state belongs to.
   */
  'app.appearance.action': 'Appearance: {appearance}',
  'app.appearance.system': 'System',
  'app.appearance.light': 'Light',
  'app.appearance.dark': 'Dark',

  'app.status.booting.title': 'Starting LifeArchive',

  'app.status.runtimeUnavailable.title': 'LifeArchive cannot start',
  'app.status.runtimeUnavailable.detail':
    'The required runtime is unavailable. No archive has been opened.',

  'app.status.incompatible.title': 'LifeArchive is incompatible',
  'app.status.incompatible.detail':
    'This application cannot safely open the archive with the available runtime.',

  'app.status.noArchive.title': 'No local archive found',
  /**
   * Worded to state what is unavailable without the phrase "an archive is
   * opened", which the availability tripwire in `test/claims.ts` reads as a
   * claim that one already is.
   */
  'app.status.noArchive.detail':
    'Record, Timeline, and Settings remain unavailable until you open an archive.',

  'app.status.opening.title': 'Opening archive',

  'app.status.locked.title': 'Archive in use',
  'app.status.locked.detail':
    'Another tab owns this archive. Nothing was replaced.',

  'app.status.recoverable.title': 'Archive needs attention',
  'app.status.recoverable.detail':
    'The previous operation did not replace or erase the archive.',

  'app.notice.recoverable.title': 'Archive connection needs attention.',
  'app.notice.recoverable.detail':
    'The last confirmed view remains visible. Retry before making further changes.',

  'app.routeError.title': 'This view could not be shown',
  'app.routeError.detail': 'The archive was not erased or replaced.',
  'app.routeError.retry': 'Try this view again',
} as const
