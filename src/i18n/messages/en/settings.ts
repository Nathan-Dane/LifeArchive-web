/**
 * Settings copy.
 *
 * There is no language setting, and there will not be one until a second
 * locale is complete. A selector that offers a half-translated language is
 * worse than no selector at all.
 */
export const settingsMessages = {
  'settings.page.title': 'Settings',
  'settings.navigation.label': 'Settings',
  'settings.navigation.yourArchive': 'Your Archive',
  'settings.navigation.preferences': 'Preferences',
  'settings.navigation.thisBrowser': 'This Browser',
  'settings.navigation.about': 'Information',
  'settings.navigation.storage.local': 'Browser archive access confirmed',
  'settings.navigation.storage.unavailable': 'Storage status unavailable',
  'settings.scope.browser': 'This Browser',
  'settings.status.notAvailable': 'Not available yet',
  'settings.overview.title': 'Overview',
  'settings.overview.detail':
    'A factual summary of the archive currently open in LifeArchive.',
  'settings.general.title': 'General',
  'settings.general.detail': 'Choose default date and startup behaviour.',
  'settings.general.dateFormat.label': 'Date format',
  'settings.general.dateFormat.detail':
    'Changes the order used for complete dates throughout LifeArchive.',
  'settings.general.dateFormat.regional': 'Regional default',
  'settings.general.dateFormat.dayMonthYear': 'Day Month Year',
  'settings.general.dateFormat.monthDayYear': 'Month Day Year',
  'settings.general.weekStartsOn.label': 'Week starts on',
  'settings.general.weekStartsOn.detail':
    'Archive week identity currently follows ISO weeks.',
  'settings.general.weekStartsOn.unavailable':
    'Fixed to Monday until archive week policy is portable',
  'settings.general.weekStartsOn.system': 'System default',
  'settings.general.weekStartsOn.monday': 'Monday',
  'settings.general.weekStartsOn.sunday': 'Sunday',
  'settings.general.openAppTo.label': 'Open app to',
  'settings.general.openAppTo.detail':
    'Applied when the root address is visited.',
  'settings.general.openAppTo.record': 'Record',
  'settings.general.openAppTo.timeline': 'Timeline',
  'settings.general.openAppTo.last': 'Last opened page',
  'settings.general.language.label': 'Language',
  'settings.general.language.detail':
    'English is the only complete interface language.',
  'settings.appearance.title': 'Appearance',
  'settings.appearance.detail': 'Changes apply immediately.',
  'settings.appearance.preview.label': 'Live Preview',
  'settings.appearance.preview.status': 'Local archive',
  'settings.appearance.preview.heading': 'A quiet place to remember',
  'settings.appearance.preview.writing':
    'Small details gather into a life when they have somewhere calm to remain.',
  'settings.appearance.preview.secondary':
    'Heading, writing, theme, and accent choices all meet here.',
  'settings.appearance.theme.section': 'Theme',
  'settings.appearance.theme.label': 'Theme',
  'settings.appearance.theme.detail':
    'System follows this device’s light or dark appearance.',
  'settings.appearance.typography.section': 'Typography',
  'settings.appearance.headingFont.label': 'Heading font',
  'settings.appearance.headingFont.detail':
    'Used for page and reflection headings.',
  'settings.appearance.writingFont.label': 'Writing font',
  'settings.appearance.writingFont.detail':
    'Used for archive writing and reading surfaces.',
  'settings.appearance.font.serif': 'Serif',
  'settings.appearance.font.system': 'System',
  'settings.appearance.accent.section': 'Accent Colour',
  'settings.appearance.accent.label': 'Accent colour',
  'settings.appearance.accent.detail':
    'Used for selection, primary actions, and focus treatment.',
  'settings.appearance.accent.gold': 'Archive Gold',
  'settings.appearance.accent.copper': 'Copper',
  'settings.appearance.accent.sage': 'Sage',
  'settings.appearance.accent.blue': 'Blue',
  'settings.appearance.accent.plum': 'Plum',
  'settings.record.title': 'Record',
  'settings.record.detail': 'Choose the starting view for Record.',
  'settings.record.initialScale.label': 'Initial scale',
  'settings.record.initialScale.detail':
    'A fixed scale keeps the previously visited date but overrides its scale.',
  'settings.record.initialScale.last': 'Remember last used',
  'settings.record.initialScale.day': 'Day',
  'settings.record.initialScale.week': 'Week',
  'settings.record.initialScale.monthValue': 'Month',
  'settings.record.initialScale.year': 'Year',
  'settings.record.scaleButtons.label': 'Show scale buttons',
  'settings.record.scaleButtons.detail':
    'Keep Day, Week, Month, and Year available without relying on gestures.',
  'settings.record.scaleButtons.required': 'Required for accessible navigation',
  'settings.record.gestures.label': 'Enable trackpad or swipe navigation',
  'settings.record.gestures.detail':
    'Move between adjacent periods with horizontal gestures.',
  'settings.record.greeting.label': 'Page greeting',
  'settings.record.greeting.detail':
    'Show or hide a greeting above the writing surface.',
  'settings.record.greeting.show': 'Show',
  'settings.record.greeting.hide': 'Hide',
  'settings.record.navigationPanel.label': 'Remember navigation-panel state',
  'settings.record.navigationPanel.detail':
    'Restore the panel state the next time Record opens.',
  'settings.timeline.title': 'Timeline',
  'settings.timeline.detail':
    'Timeline preferences will become available as its web view is implemented.',
  'settings.timeline.limit.label': 'Limit Timeline Scrolling',
  'settings.timeline.limit.detail':
    'Keep Timeline navigation near the first and last archive entries.',
  'settings.timeline.scaleButtons.label': 'Show scale buttons',
  'settings.timeline.scaleButtons.detail':
    'Show Day, Week, Month, and Year controls in Timeline.',
  'settings.timeline.zoom.label': 'Enable pinch or trackpad zoom',
  'settings.timeline.zoom.detail':
    'Change Timeline scale with supported zoom gestures.',
  'settings.timeline.initialScale.label': 'Initial scale',
  'settings.timeline.initialScale.detail':
    'Choose the scale Timeline opens with.',
  'settings.timeline.motion.label': 'Reduce Timeline motion',
  'settings.timeline.motion.detail':
    'Timeline motion normally follows the operating-system preference.',
  'settings.timeline.motion.system': 'Follows the system',
  'settings.timeline.browserOnly':
    'These controls are visible for planning, but none change Timeline yet.',
  'settings.lifeDetails.title': 'Life Details',
  'settings.lifeDetails.detail':
    'Portable identity stored with this archive and included in its exports.',
  'settings.lifeDetails.loading': 'Loading archive identity…',
  'settings.lifeDetails.unavailable':
    'Life details could not be loaded. No identity values were replaced.',
  'settings.lifeDetails.archive.section': 'Archive',
  'settings.lifeDetails.archiveName.label': 'Archive name',
  'settings.lifeDetails.archiveName.detail':
    'The title used to identify this archive.',
  'settings.lifeDetails.myLife.label': 'This is my life',
  'settings.lifeDetails.myLife.detail':
    'Mark the archive subject as the person using LifeArchive.',
  'settings.lifeDetails.person.section': 'Person',
  'settings.lifeDetails.displayName.label': 'Display name',
  'settings.lifeDetails.displayName.detail':
    'The full name shown for the archive subject.',
  'settings.lifeDetails.shortName.label': 'Short name',
  'settings.lifeDetails.shortName.detail':
    'A familiar name for compact surfaces.',
  'settings.lifeDetails.status.label': 'Life status',
  'settings.lifeDetails.status.detail':
    'Whether the archive subject is living or deceased.',
  'settings.lifeDetails.status.unspecified': 'Not specified',
  'settings.lifeDetails.status.living': 'Living',
  'settings.lifeDetails.status.deceased': 'Deceased',
  'settings.lifeDetails.birth.label': 'Date of birth',
  'settings.lifeDetails.birth.detail':
    'A civil date stored without a time or time zone.',
  'settings.lifeDetails.death.label': 'Date of death',
  'settings.lifeDetails.death.detail':
    'Shown and stored when the life status is Deceased.',
  'settings.lifeDetails.clearDeath.title': 'Clear the date of death?',
  'settings.lifeDetails.clearDeath.detail':
    'Changing from Deceased will clear the date of death when you save.',
  'settings.lifeDetails.clearDeath.confirm': 'Clear date and change status',
  'settings.lifeDetails.clearDeath.cancel': 'Keep current status',
  'settings.lifeDetails.save': 'Save life details',
  'settings.lifeDetails.saving': 'Saving…',
  'settings.lifeDetails.saved': 'Life details updated.',
  'settings.lifeDetails.saveFailed':
    'No changes were written. Your edits remain in this form.',
  'settings.archive.title.fallback': 'Your Archive',
  'settings.archive.title.subject': '{name}’s Archive',
  'settings.archive.overview.loading': 'Loading archive overview…',
  'settings.archive.overview.unavailable':
    'The archive overview could not be loaded. No archive facts were invented.',
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
  'settings.archive.entries.events': {
    one: '{count} event',
    other: '{count} events',
  },
  'settings.archive.entries.spans': {
    one: '{count} span',
    other: '{count} spans',
  },
  'settings.archive.media.label': 'Media',
  'settings.archive.media.summary': {
    one: '{count} item · {size}',
    other: '{count} items · {size}',
  },
  'settings.archive.storage.title': 'Local storage',
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
  'settings.archive.storage.persistencePermission.label':
    'Browser retention permission',
  'settings.archive.storage.persistencePermission.detail':
    'Ask this browser to reduce the chance that it automatically evicts this origin’s data.',
  'settings.archive.storage.persistencePermission.action': 'Request permission',
  'settings.archive.storage.persistencePermission.requesting': 'Requesting…',
  'settings.archive.storage.persistencePermission.granted': 'Granted',
  'settings.archive.storage.persistencePermission.unsupported': 'Not supported',
  'settings.archive.storage.browserStatus.label': 'Browser storage status',
  'settings.archive.storage.browserStatus.confirmed':
    'Archive access confirmed',
  'settings.archive.storage.browserStatus.unconfirmed':
    'Archive access not confirmed',
  'settings.archive.storage.entries.label': 'Entries storage',
  'settings.archive.storage.entries.detail':
    'Exact entry byte usage is not reported by the current runtime.',
  'settings.archive.storage.media.label': 'Media storage',
  'settings.archive.storage.total.label': 'Total archive storage',
  'settings.archive.storage.total.detail':
    'Browser estimates cover the entire origin, not only this archive.',
  'settings.archive.storage.unavailableValue': 'Unavailable',
  'settings.archive.lastExport.label': 'Last export',
  'settings.archive.lastImport.label': 'Last import',
  'settings.archive.lastVerification.label': 'Last verification',
  'settings.archive.history.section': 'Operation History',
  'settings.archive.history.unavailable': 'Not recorded',
  'settings.archive.history.notRecorded':
    'The current runtime does not expose a reliable timestamp.',
  'settings.archive.format.label': 'Archive format version',
  'settings.archive.manage.title': 'Manage Archive',
  'settings.archive.manage.detail':
    'Export, verify, import, or deliberately erase this archive.',
  'settings.archive.manage.intro':
    'Create a copy, check a package, merge another archive, or start over.',
  'settings.archive.manage.storage.section': 'Storage',
  'settings.archive.manage.tools.section': 'Archive Tools',
  'settings.archive.manage.danger.section': 'Danger Zone',
  'settings.archive.manage.back': 'Back to Settings',
  'settings.about.title': 'About',
  'settings.about.detail':
    'Versions, privacy, source information, and interface controls.',
  'settings.about.version.section': 'Versions',
  'settings.about.webVersion.label': 'LifeArchive web version',
  'settings.about.runtimeVersion.label': 'Runtime version',
  'settings.about.runtimeBuild.label': 'Runtime build',
  'settings.about.runtimeVersion.unavailable': 'Unavailable',
  'settings.about.buildVersion.label': 'Build version',
  'settings.about.buildVersion.detail':
    'This web build does not publish a separate build identifier.',
  'settings.about.archiveFormat.label': 'Current archive format',
  'settings.about.archiveFormat.detail':
    'The runtime does not expose the portable archive-package format version.',
  'settings.about.privacy.section': 'Privacy',
  'settings.about.privacy.title': 'Local first by design',
  'settings.about.privacy.detail':
    'The local runtime handles archive reading and editing. Life details stay with the archive, and Export creates the separate copy you can keep elsewhere.',
  'settings.about.openSource.section': 'Source and Licences',
  'settings.about.openSource.label': 'Open-source web interface',
  'settings.about.openSource.detail':
    'The web interface is available under MPL-2.0. The compiled archive runtime is distributed separately under its own terms.',
  'settings.about.openSource.action': 'View source',
  'settings.about.licences.label': 'Licences and notices',
  'settings.about.licences.detail':
    'Read the exact terms and bundled notices for this repository.',
  'settings.about.licences.license': 'Licence',
  'settings.about.licences.notice': 'Notices',
  'settings.about.reset.section': 'This Browser',
  'settings.about.reset.label': 'Reset interface preferences',
  'settings.about.reset.detail':
    'Reset theme, fonts, accent, date order, startup, and Record cursor preferences. Archive content is not touched.',
  'settings.about.reset.action': 'Reset preferences',
  'settings.about.reset.complete':
    'Interface preferences were reset. Archive content was not changed.',
  'archive.erase.eyebrow': 'Destructive action',
  'archive.erase.title': 'Erase this archive',
  'archive.erase.compactTitle': 'Erase archive',
  'archive.erase.compactDetail':
    'Permanently replace this browser archive with an empty one.',
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
