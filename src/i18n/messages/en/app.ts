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
  'app.archive.local': 'Local-first',

  'app.navigation.main': 'Main',
  'app.navigation.record': 'Record',
  'app.navigation.timeline': 'Timeline',
  'app.navigation.settings': 'Settings',

  'app.action.retry': 'Try again',
  'app.action.reload': 'Reload application',
  'app.action.openArchive': 'Open archive',
  'app.action.skipToContent': 'Skip to main content',
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
  'app.status.browserUnsupported.title': 'Browser not supported',
  'app.status.browserUnsupported.detail':
    'This browser cannot provide the secure worker support LifeArchive requires. No archive has been opened.',
  'app.status.browserUnsupported.engine':
    'This browser engine has not passed LifeArchive’s local archive safety checks. No archive has been opened.',
  'app.status.browserUnsupported.version':
    'This browser version is outside the versions qualified for LifeArchive’s local archive safety checks. No archive has been opened.',
  'app.status.browserUnsupported.device':
    'This browser’s device mode has not been qualified for LifeArchive’s local archive storage. No archive has been opened.',
  'app.status.browserUnsupported.storage':
    'Private or incognito browser storage is not supported. Open LifeArchive in a regular browser window. No archive has been opened.',

  'app.status.incompatible.title': 'LifeArchive is incompatible',
  'app.status.incompatible.detail':
    'This application cannot safely open the archive with the available runtime.',

  /*
   * There is no "no archive" status screen: that state is the first run, and
   * its copy lives with the feature that offers to create one.
   */
  'app.status.opening.title': 'Opening archive',
  'app.status.recovering.title': 'Recovering archive',
  'app.status.recovering.detail':
    'LifeArchive is asking the runtime to recover the existing archive. It will not create a replacement.',
  'app.status.closing.title': 'Closing archive',
  'app.status.closed.title': 'Archive closed',
  'app.status.closed.detail':
    'The archive was closed cleanly. Open it again to continue.',

  'app.status.locked.title': 'Archive in use',
  'app.status.locked.detail':
    'Another tab owns this archive. Nothing was replaced.',

  'app.status.recoverable.title': 'Archive needs attention',
  'app.status.recoverable.detail':
    'The previous operation did not replace or erase the archive.',
  'app.status.newerArchive.title': 'Archive needs a newer LifeArchive',
  'app.status.corruptArchive.title': 'Archive could not be read safely',
  'app.status.recoveryIncomplete.title': 'Archive recovery did not finish',
  'app.status.storageFailure.title': 'Storage could not open the archive',

  'app.notice.recoverable.title': 'Archive connection needs attention.',
  'app.notice.recoverable.detail':
    'The last confirmed view remains visible. Retry before making further changes.',

  'app.routeError.title': 'This view could not be shown',
  'app.routeError.detail': 'The archive was not erased or replaced.',
  'app.routeError.retry': 'Try this view again',
} as const
