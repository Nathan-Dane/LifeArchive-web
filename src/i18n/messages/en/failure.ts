/**
 * Wording for the stable failure codes the client reports.
 *
 * `ClientFailure` carries no message: the core decides what happened, and this
 * catalog decides how to say it. Two rules apply to every phrase here.
 *
 * 1. **Say what was not done.** A person reading a failure needs to know their
 *    writing survived and that nothing was erased or replaced.
 * 2. **Never claim durability.** Until the runtime exists, no failure phrase
 *    may imply anything was kept.
 *
 * A code with no entry is not an error. `failureMessages.ts` falls back to
 * `failure.generic`, which is true of every failure.
 */
export const failureMessages = {
  'failure.generic':
    'Something did not complete. Nothing was erased or replaced.',

  'failure.busyRetryable':
    'The archive is busy with another operation. Nothing was changed.',
  'failure.cancelled': 'The operation was cancelled. Nothing was changed.',
  'failure.cleanupIncomplete':
    'The operation stopped part-way and tidying up did not finish. Nothing you wrote was discarded.',
  'failure.closed':
    'The archive closed before the operation finished. Nothing was changed.',
  'failure.corruptStore':
    'The archive could not be read as valid. Nothing was erased or replaced.',
  'failure.duplicateOperation':
    'That operation was already under way, so it was not run a second time.',
  'failure.invalidIdentifier':
    'That item could not be identified. Nothing was changed.',
  'failure.invalidRequest':
    'The request was rejected as invalid. Nothing was changed.',
  'failure.invalidRoot':
    'That location is not a valid LifeArchive root. Nothing was erased or replaced.',
  'failure.invalidationExhausted':
    'The archive changed more times than this session can track. Reload the application to continue.',
  'failure.ioFailure':
    'The device reported a storage error. Nothing was erased or replaced.',
  'failure.recoveryIncomplete':
    'Recovery did not finish. Nothing was erased or replaced.',
  'failure.revisionConflict':
    'This item changed elsewhere since it was read. Review your version before continuing.',
  'failure.revisionExhausted': 'This item cannot take any further revisions.',
  'failure.storeAlreadyOpen':
    'Another tab owns this archive. Nothing was replaced.',
  'failure.staleArchiveGeneration':
    'The archive was replaced while this operation was in progress. A result from the previous archive was ignored.',
  'failure.unsupportedCapability':
    'This browser does not offer something LifeArchive requires.',
  'failure.unsupportedContractVersion':
    'This version of LifeArchive cannot work with the runtime it found.',
  'failure.unsupportedLayout':
    'The archive uses a layout this version does not understand. Nothing was changed.',
  'failure.unsupportedSchema':
    'The archive uses a newer format than this version understands. Nothing was changed.',
} as const
