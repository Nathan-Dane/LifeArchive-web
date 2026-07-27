/**
 * Archive-lifecycle copy, beginning with the first run.
 *
 * Two rules govern every phrase here, and both are data-safety rules rather
 * than wording preferences:
 *
 * 1. **Nothing claims durability the platform has not given.** The browser
 *    decides whether it keeps this origin's data, and it may refuse, may say
 *    nothing, or may not be askable at all. Each of those has its own sentence,
 *    and none of them is softened into the granted one.
 * 2. **A failure says what did not happen.** A first run that fails created no
 *    archive and replaced nothing, and the reader is told so plainly rather
 *    than left to wonder what the attempt left behind.
 */
export const archiveMessages = {
  'archive.firstRun.title': 'Create your local archive',
  'archive.firstRun.intro':
    'LifeArchive keeps one archive in this browser, on this device. There is no account, no server, and nothing leaves the device unless you export it yourself.',
  'archive.firstRun.copies':
    'Nothing here makes a second copy for you. An export you make and keep somewhere else is the only copy that survives losing this browser.',

  /**
   * Durability as the runtime reports it, one sentence per reported value.
   * There is no fourth sentence for "we did not ask": when the runtime has not
   * answered, the line is absent rather than optimistic.
   */
  'archive.firstRun.durability.durable':
    'The runtime reports durable local storage for this archive.',
  'archive.firstRun.durability.bestEffort':
    'The runtime reports best-effort local storage for this archive, so a write is not guaranteed to survive a crash.',
  'archive.firstRun.durability.unproven':
    'The runtime has not confirmed durable local storage for this archive.',

  'archive.firstRun.estimate':
    'The browser estimates roughly {quota} of space for this site, with about {used} in use. Browser estimates are approximate.',

  'archive.firstRun.action.create': 'Create archive',
  'archive.firstRun.action.createAnyway': 'Create archive anyway',
  'archive.firstRun.action.askAgain': 'Ask the browser again',

  'archive.firstRun.status.requestingStorage':
    'Asking the browser to keep this site’s data',
  'archive.firstRun.status.creating': 'Creating the archive',
  'archive.firstRun.status.opening': 'Opening Record',

  'archive.firstRun.storage.title':
    'The browser will not promise to keep this data',
  'archive.firstRun.storage.denied':
    'Your browser refused the request to keep this site’s data.',
  'archive.firstRun.storage.unknown':
    'Your browser would not say whether it keeps this site’s data.',
  'archive.firstRun.storage.unsupported':
    'This browser cannot be asked whether it keeps this site’s data.',
  'archive.firstRun.storage.consequence':
    'It may clear the archive when the device runs short of space, or when you clear browsing data.',
  'archive.firstRun.storage.advice':
    'You can still create the archive. Export it regularly so a clearance is not a loss.',

  'archive.firstRun.locked.title': 'Another tab owns the local archive',
  'archive.firstRun.locked.detail':
    'Close the other LifeArchive tab and try again. Nothing was created and nothing was replaced.',

  'archive.firstRun.failed.title': 'The archive was not created',
  'archive.firstRun.failed.detail':
    'Nothing was created and nothing was replaced.',
} as const
