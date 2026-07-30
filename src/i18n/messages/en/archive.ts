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

  'archive.import.eyebrow': 'Archive lifecycle',
  'archive.import.title': 'Import an archive',
  'archive.import.compactTitle': 'Import',
  'archive.import.compactDetail':
    'Merge writing and media from an archive package.',
  'archive.import.detail':
    'Choose a supported LifeArchive package. It is checked and applied as one operation; if it cannot be applied, the open archive stays in place.',
  'archive.import.file.label': 'Archive package',
  'archive.import.file.selected': 'Selected: {name}',
  'archive.import.file.invalidExtension':
    'Choose a file ending in .lifearchive.tar.',
  'archive.import.file.invalidType':
    'That file type is not supported. Choose a LifeArchive package.',
  'archive.import.file.empty': 'That package is empty and cannot be imported.',
  'archive.import.action.import': 'Import archive',
  'archive.import.action.cancel': 'Cancel import',
  'archive.import.action.chooseAnother': 'Choose another package',
  'archive.import.status.progress': 'Archive import progress',
  'archive.import.status.importing': 'Checking and importing the archive',
  'archive.import.status.cancelling':
    'Requesting cancellation and waiting for a final result',
  'archive.import.failed.title': 'The archive was not imported',
  'archive.import.failed.unchanged':
    'The archive that was open before this attempt is still open.',
  'archive.import.failed.differentArchive':
    'This package belongs to a different archive identity, so it was not applied.',
  'archive.import.complete.title': 'Import complete',
  'archive.import.complete.announcement': 'Archive import complete',
  'archive.import.noOp.title': 'Nothing new to import',
  'archive.import.noOp.detail':
    'The package made no durable changes to writing, media, Tracks, archive identity, or recovery state.',
  'archive.import.count.importedEntries': 'Writing imported',
  'archive.import.count.importedMedia': 'Media imported',
  'archive.import.count.importedTracks': 'Tracks imported',
  'archive.import.count.skippedEntries': 'Existing writing skipped',
  'archive.import.count.skippedMedia': 'Existing media skipped',
  'archive.import.count.skippedTracks': 'Existing Tracks skipped',
  'archive.import.recovery.pending':
    'The import committed, but recovery cleanup is still pending. Reopen the archive before retrying.',
  'archive.import.issues': {
    one: 'One invalid item was skipped without changing the rest of the import.',
    other:
      '{count} invalid items were skipped without changing the rest of the import.',
  },
  'archive.import.identity.preserved':
    'The current archive identity was preserved.',
  'archive.import.identity.adopted':
    'The imported archive identity was adopted.',
  'archive.import.identity.matched':
    'The package and current archive identities matched.',
  'archive.import.identity.filled':
    'Empty archive identity details were filled from the package.',
  'archive.import.identity.conflicts': {
    one: 'Empty identity details were filled; one existing identity detail was kept.',
    other:
      'Empty identity details were filled; {count} existing identity details were kept.',
  },
  'archive.import.identity.conflictsOnly': {
    one: 'One existing identity detail was kept unchanged.',
    other: '{count} existing identity details were kept unchanged.',
  },

  'archive.export.eyebrow': 'Portable archive',
  'archive.export.title': 'Export this archive',
  'archive.export.compactTitle': 'Export',
  'archive.export.compactDetail':
    'Download a portable copy with writing and media.',
  'archive.export.detail':
    'LifeArchive asks the core to create and verify one self-contained package, including original media. Your browser then chooses where the download goes.',
  'archive.export.action.export': 'Create export',
  'archive.export.action.cancel': 'Cancel export',
  'archive.export.action.startOver': 'Start over',
  'archive.export.action.tryDownloadAgain': 'Try download again',
  'archive.export.action.exportAnother': 'Create another export',
  'archive.export.status.progress': 'Archive export progress',
  'archive.export.status.exporting': 'Creating and checking the archive',
  'archive.export.status.cancelling':
    'Requesting cancellation and waiting for a final result',
  'archive.export.status.delivering':
    'Handing the verified package to the browser',
  'archive.export.failed.title': 'The archive was not exported',
  'archive.export.failed.noOutput':
    'No package was handed to the browser from this attempt.',
  'archive.export.cancelled.title': 'Export cancelled',
  'archive.export.cancelled.detail':
    'Cancellation finished and no package was handed to the browser.',
  'archive.export.cancelled.announcement': 'Archive export cancelled',
  'archive.export.deliveryFailed.title': 'The download did not start',
  'archive.export.deliveryFailed.detail':
    'The core created and verified the package, but the browser did not accept the download handoff.',
  'archive.export.complete.title': 'Verified package ready',
  'archive.export.complete.detail':
    'The verified package {name} was handed to your browser for download.',
  'archive.export.complete.browserDestination':
    'Your browser controls the final location and handles an existing filename. Confirm the download in your browser before relying on it.',
  'archive.export.complete.announcement':
    'Verified archive handed to the browser',
  'archive.export.count.entries': 'Writing included',
  'archive.export.count.media': 'Media included',
  'archive.export.count.filesChecked': 'Files checked',

  'archive.verify.eyebrow': 'Read-only check',
  'archive.verify.title': 'Verify an archive',
  'archive.verify.compactTitle': 'Verify',
  'archive.verify.compactDetail':
    'Check an archive package without changing either copy.',
  'archive.verify.detail':
    'Choose a LifeArchive package for a standalone integrity check. Verification does not open, import, replace, back up, or sync anything.',
  'archive.verify.file.label': 'Archive package to verify',
  'archive.verify.file.selected': 'Selected: {name}',
  'archive.verify.file.invalidExtension':
    'Choose a file ending in .lifearchive.tar.',
  'archive.verify.file.invalidType':
    'That file type is not supported. Choose a LifeArchive package.',
  'archive.verify.file.empty': 'That package is empty and cannot be verified.',
  'archive.verify.action.verify': 'Verify archive',
  'archive.verify.action.chooseAnother': 'Choose another package',
  'archive.verify.status.progress': 'Archive verification progress',
  'archive.verify.status.verifying': 'Checking the selected archive',
  'archive.verify.failed.title': 'The archive could not be verified',
  'archive.verify.failed.newer':
    'This package was made by a newer archive format that this version cannot verify.',
  'archive.verify.readOnly':
    'The open archive and the selected package were not changed.',
  'archive.verify.valid.title': 'Archive verified',
  'archive.verify.valid.detail': {
    one: 'The package is valid. One file was checked.',
    other: 'The package is valid. {count} files were checked.',
  },
  'archive.verify.valid.announcement':
    'Archive verified with {count} files checked',
  'archive.verify.invalid.title': 'Archive not valid',
  'archive.verify.invalid.detail': {
    one: 'The core found one integrity issue. This package should not be imported.',
    other:
      'The core found {count} integrity issues. This package should not be imported.',
  },
} as const
