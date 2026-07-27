/**
 * Settings copy.
 *
 * There is no language setting, and there will not be one until a second
 * locale is complete. A selector that offers a half-translated language is
 * worse than no selector at all.
 */
export const settingsMessages = {
  'settings.page.title': 'Settings',
  'settings.archive.title.fallback': 'Your Archive',
  'settings.archive.title.subject': '{name}’s Archive',
  'settings.archive.overview.loading': 'Loading archive overview…',
  'settings.archive.overview.unavailable':
    'The archive overview could not be loaded. Archive management is still available.',
  'settings.archive.health.label': 'Status',
  'settings.archive.health.healthy': 'Healthy',
  'settings.archive.health.verified': 'Healthy',
  'settings.archive.health.recoveryClean':
    'Integrity verified · Recovery state clean',
  'settings.archive.entries.label': 'Entries',
  'settings.archive.entries.total': '{count} total',
  'settings.archive.entries.breakdown': 'Entry counts by scale',
  'settings.archive.entries.days': {
    one: '{count} day',
    other: '{count} days',
  },
  'settings.archive.entries.weeks': {
    one: '{count} week',
    other: '{count} weeks',
  },
  'settings.archive.entries.months': {
    one: '{count} month',
    other: '{count} months',
  },
  'settings.archive.entries.years': {
    one: '{count} year',
    other: '{count} years',
  },
  'settings.archive.media.label': 'Media',
  'settings.archive.media.summary': {
    one: '{count} item · {size}',
    other: '{count} items · {size}',
  },
  'settings.archive.storage.title': 'Browser storage',
  'settings.archive.storage.loading': 'Checking storage facts…',
  'settings.archive.storage.unavailable':
    'Storage facts are not available right now.',
  'settings.archive.storage.persistence.label': 'Browser retention',
  'settings.archive.storage.grant.granted': 'Granted by this browser',
  'settings.archive.storage.grant.denied': 'Not granted by this browser',
  'settings.archive.storage.grant.unknown': 'Not confirmed by this browser',
  'settings.archive.storage.grant.unsupported': 'Not reported by this browser',
  'settings.archive.storage.estimate.label': 'Approximate browser usage',
  'settings.archive.storage.estimate.value':
    '{used} used of approximately {quota}',
  'settings.archive.storage.estimate.unavailable':
    'No estimate available from this browser',
  'settings.archive.storage.runtime.label': 'Runtime durability',
  'settings.archive.storage.runtime.unavailable':
    'Not available from the runtime',
  'settings.archive.storage.durability.durable':
    'Reported as durable by the runtime',
  'settings.archive.storage.durability.bestEffort':
    'Reported as best effort by the runtime',
  'settings.archive.storage.durability.unproven':
    'Not proven durable by the runtime',
  'settings.archive.storage.localOpen':
    'The runtime confirms browser-local archive access for this session. Export is the way to keep a separate copy outside this app.',
  'settings.archive.storage.localUnknown':
    'The runtime did not confirm browser-local archive access for this session. Archive management remains available.',
  'settings.archive.manage.title': 'Manage Archive',
  'settings.archive.manage.detail':
    'Export, verify, import, or deliberately erase this archive.',
  'settings.archive.manage.intro':
    'Manage this browser-local archive without changing its identity or replacing it automatically.',
  'settings.archive.manage.back': 'Back to Settings',
  'archive.erase.eyebrow': 'Destructive action',
  'archive.erase.title': 'Erase this archive',
  'archive.erase.detail':
    'Permanently remove this browser-local archive and replace it with a fresh, usable empty archive.',
  'archive.erase.exportsPreserved':
    'Previously downloaded exports are separate files and will not be deleted.',
  'archive.erase.action.request': 'Erase archive…',
  'archive.erase.action.cancel': 'Cancel',
  'archive.erase.confirm.title': 'Erase this archive permanently?',
  'archive.erase.confirm.detail':
    'This removes all writing, structured records, media, and identity stored in this browser. This action cannot be undone.',
  'archive.erase.action.confirm': 'Erase this archive',
  'archive.erase.status.progress': 'Archive erase progress',
  'archive.erase.status.erasing': 'Erasing the browser-local archive…',
  'archive.erase.status.refreshing': 'Opening the fresh empty archive…',
  'archive.erase.failed.title': 'The archive was not erased',
  'archive.erase.failed.priorPreserved':
    'The erase did not complete. The prior archive and recovery evidence remain available.',
  'archive.erase.recovery.title': 'Recovery is required',
  'archive.erase.recovery.failure':
    'The erase did not return a confirmed final state.',
  'archive.erase.recovery.detail':
    'The final erase outcome could not be confirmed, or media recovery is still pending. Reload LifeArchive to reopen this same archive and finish recovery before taking another action.',
  'archive.erase.action.reload': 'Reload and recover',
  'archive.erase.action.tryAgain': 'Try erase again…',
  'archive.erase.refreshFailed.title': 'The archive was erased',
  'archive.erase.refreshFailed.detail':
    'The coordinated erase completed, but the fresh empty archive could not be confirmed. Check the fresh archive again; do not repeat the erase.',
  'archive.erase.action.checkFresh': 'Check fresh archive',
  'archive.erase.action.dismiss': 'Dismiss erase result',
  'archive.erase.complete.title': 'Fresh archive created',
  'archive.erase.complete.detail':
    '{name} now has a fresh identity and an empty local store.',
  'archive.erase.complete.entries': 'Entries',
  'archive.erase.complete.media': 'Media',
  'archive.erase.complete.announcement':
    'The prior archive was erased and a fresh empty archive was created.',
} as const
