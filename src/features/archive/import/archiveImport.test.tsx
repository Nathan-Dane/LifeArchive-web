import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import {
  clientFailure,
  failed,
  ok,
  operationId,
  revision,
  stableId,
  type ArchiveImportInspection,
  type ArchiveImportResult,
  type ClientFailure,
  type ClientResult,
  type LifeArchiveClient,
} from '../../../core/client'
import { I18nProvider } from '../../../i18n'
import {
  ARCHIVE_TRANSPORT_EXTENSION,
  ARCHIVE_TRANSPORT_MIME_TYPE,
} from '../../../platform/files/archiveTransfer'
import { ArchiveImportPanel } from './ArchiveImportPanel'

const OPERATION_ID = operationId('7f1c0a10-0000-4000-8000-0000000000b1')
const ITEM_ID = stableId('7f1c0a10-0000-4000-8000-000000000099')

const READY_INSPECTION: ArchiveImportInspection = {
  workflowVersion: '1',
  outcome: 'ready',
  context: {
    supportedFormatVersion: '0.4.1',
    archiveFormatVersion: '0.4.1',
    formatRelation: 'supported',
    sourceSubjectName: 'Alex',
    destinationSubjectName: 'Alex',
  },
  planId: 'ready-plan',
  source: {
    archiveName: 'Family archive',
    subjectName: 'Alex',
    createdAt: '2026-08-04T10:00:00Z',
    formatVersion: '5',
  },
  counts: {
    entries: {
      total: 14,
      importable: 12,
      alreadyPresent: 2,
      needsDecision: 0,
    },
    media: {
      total: 3,
      importable: 3,
      alreadyPresent: 0,
      needsDecision: 0,
    },
    tracks: {
      total: 2,
      importable: 2,
      alreadyPresent: 0,
      needsDecision: 0,
    },
  },
  issues: [],
}

const RESULT: ArchiveImportResult = {
  changed: true,
  recovery: 'clean',
  importedEntries: 12,
  importedMedia: 3,
  importedTracks: 2,
  skippedEntries: 2,
  skippedMedia: 0,
  skippedTracks: 0,
  skippedEntryIds: [ITEM_ID],
  skippedMediaIds: [],
  skippedTrackIds: [],
  issues: [],
  identity: { outcome: 'matched' },
  invalidation: {
    storeInstanceId: 'after-import',
    revision: revision('2'),
  },
}

function packageFile(
  name = `Selected${ARCHIVE_TRANSPORT_EXTENSION}`,
  type = ARCHIVE_TRANSPORT_MIME_TYPE,
): File {
  const file = new File([Uint8Array.from([1, 2, 3])], name, { type })
  Object.defineProperty(file, 'stream', {
    configurable: true,
    value: () => new ReadableStream<Uint8Array>(),
  })
  return file
}

function failure(
  code: string,
  options: {
    readonly retryable?: boolean
    readonly durableOutcome?: 'known' | 'unknown' | 'not-started'
  } = {},
): ClientFailure {
  return clientFailure({
    area: 'archive',
    code,
    phase: 'mutation',
    retryable: options.retryable ?? false,
    durableOutcome: options.durableOutcome ?? 'known',
  })
}

function stubClient({
  inspectionResult = ok(READY_INSPECTION),
  importResult = ok(RESULT),
}: {
  readonly inspectionResult?: ClientResult<ArchiveImportInspection>
  readonly importResult?:
    | ClientResult<ArchiveImportResult>
    | Promise<ClientResult<ArchiveImportResult>>
} = {}) {
  const inspectImport = vi.fn(() => Promise.resolve(inspectionResult))
  const importArchive = vi.fn(() => Promise.resolve(importResult))
  const requestCancel = vi.fn(() =>
    Promise.resolve(
      ok({
        operationId: OPERATION_ID,
        outcome: 'requested' as const,
      }),
    ),
  )
  const client = {
    archive: { inspectImport, import: importArchive },
    operations: {
      newOperationId: () => OPERATION_ID,
      requestCancel,
    },
  } as unknown as LifeArchiveClient
  return { client, inspectImport, importArchive, requestCancel }
}

function renderImport(client: LifeArchiveClient) {
  return render(
    <I18nProvider locale="en">
      <h1>Settings</h1>
      <p>Previously open archive</p>
      <ArchiveImportPanel client={client} />
    </I18nProvider>,
  )
}

async function selectForReview(client: LifeArchiveClient) {
  const user = userEvent.setup()
  renderImport(client)
  await user.upload(screen.getByLabelText('Archive package'), packageFile())
  await screen.findByRole('heading', { name: 'Ready to import' })
  return user
}

async function selectAndImport(client: LifeArchiveClient) {
  const user = await selectForReview(client)
  await user.click(
    screen.getByRole('button', { name: 'Import reviewed items' }),
  )
  return user
}

describe('reviewable archive import', () => {
  it('inspects an opaque package before applying the returned plan', async () => {
    const { client, inspectImport, importArchive } = stubClient()
    await selectAndImport(client)

    expect(
      await screen.findByRole('heading', { name: 'Import complete' }),
    ).toBeInTheDocument()
    expect(inspectImport).toHaveBeenCalledWith({ archive: expect.any(File) })
    expect(importArchive).toHaveBeenCalledWith({
      operationId: OPERATION_ID,
      archive: expect.any(File),
      expectedPlanId: 'ready-plan',
      resolutions: { selections: [] },
    })
  })

  it('keeps automatic duplicate notices out of the required choices', async () => {
    const inspection: ArchiveImportInspection = {
      ...READY_INSPECTION,
      outcome: 'needsResolution',
      planId: 'resolution-plan',
      counts: {
        ...READY_INSPECTION.counts,
        entries: {
          total: 2,
          importable: 0,
          alreadyPresent: 1,
          needsDecision: 1,
        },
      },
      issues: [
        {
          issueId: 'duplicate-notice',
          code: 'duplicateRecord',
          severity: 'info',
          category: 'duplicate',
          disposition: 'automatic',
          causeCode: null,
          field: null,
          path: 'entries/existing.json',
          line: null,
          recordKind: 'entry',
          id: null,
          allowedResolutions: [],
        },
        {
          issueId: 'bad-record',
          code: 'invalidEntrySkipped',
          severity: 'warning',
          category: 'record',
          disposition: 'requiresDecision',
          causeCode: 'invalidDate',
          field: 'date',
          path: 'entries/bad.json',
          line: 7,
          recordKind: 'entry',
          id: ITEM_ID,
          allowedResolutions: ['skip', 'ignore'],
        },
      ],
    }
    const { client, importArchive } = stubClient({
      inspectionResult: ok(inspection),
    })
    const user = userEvent.setup()
    renderImport(client)
    await user.upload(screen.getByLabelText('Archive package'), packageFile())

    expect(
      await screen.findByRole('heading', { name: 'Issues importing archive' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Handled by the import plan.')).toBeInTheDocument()
    const badEntryHeading = screen.getByRole('heading', {
      name: 'A writing item can’t be read',
    })
    const badEntry = badEntryHeading.closest('article')
    expect(badEntry).not.toBeNull()
    expect(badEntryHeading).not.toHaveTextContent('entries/bad.json')
    await user.click(
      within(badEntry as HTMLElement).getByText('Technical details'),
    )
    expect(
      within(badEntry as HTMLElement).getByText('entries/bad.json'),
    ).toBeInTheDocument()
    const apply = screen.getByRole('button', {
      name: 'Import reviewed items',
    })
    expect(apply).toBeDisabled()

    await user.click(screen.getByRole('radio', { name: 'Skip this item' }))
    expect(apply).toBeEnabled()
    await user.click(apply)

    await screen.findByRole('heading', { name: 'Import complete' })
    expect(importArchive).toHaveBeenCalledWith({
      operationId: OPERATION_ID,
      archive: expect.any(File),
      expectedPlanId: 'resolution-plan',
      resolutions: {
        selections: [{ issueId: 'bad-record', optionId: 'skip' }],
      },
    })
  })

  it('shows a blocked report without offering to apply it', async () => {
    const { client, importArchive } = stubClient({
      inspectionResult: ok({
        ...READY_INSPECTION,
        outcome: 'blocked',
        context: {
          ...READY_INSPECTION.context,
          archiveFormatVersion: '0.5.0',
          formatRelation: 'newer',
        },
        planId: null,
        issues: [
          {
            issueId: 'new-format',
            code: 'archiveValidationFailed',
            severity: 'error',
            category: 'format',
            disposition: 'blocked',
            causeCode: 'unsupportedVersion',
            field: null,
            path: 'manifest.json',
            line: null,
            recordKind: 'package',
            id: null,
            allowedResolutions: [],
          },
        ],
      }),
    })
    const user = userEvent.setup()
    renderImport(client)
    await user.upload(screen.getByLabelText('Archive package'), packageFile())

    expect(
      await screen.findByRole('heading', {
        name: 'Errors importing archive',
      }),
    ).toBeInTheDocument()
    expect(screen.getByText('Cannot import this archive')).toBeInTheDocument()
    expect(document.body).toHaveTextContent(
      /Archive format 0.5.0; this app imports 0.4.1/i,
    )
    expect(document.body).toHaveTextContent(/Update the app/i)
    expect(
      screen.getByRole('button', { name: 'Import reviewed items' }),
    ).toBeDisabled()
    expect(
      screen.getByText(
        'This issue has no available fix in the current import.',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByText('Handled by the import plan.')).toBeNull()
    expect(importArchive).not.toHaveBeenCalled()
  })

  it('explains an outdated archive format differently from a newer one', async () => {
    const { client } = stubClient({
      inspectionResult: ok({
        ...READY_INSPECTION,
        outcome: 'blocked',
        context: {
          ...READY_INSPECTION.context,
          archiveFormatVersion: '0.3.0',
          formatRelation: 'older',
        },
        planId: null,
        source: null,
        issues: [
          {
            issueId: 'old-format',
            code: 'archiveValidationFailed',
            severity: 'error',
            category: 'format',
            disposition: 'blocked',
            causeCode: 'unsupportedVersion',
            field: null,
            path: 'manifest.json',
            line: null,
            recordKind: 'package',
            id: null,
            allowedResolutions: [],
          },
        ],
      }),
    })
    const user = userEvent.setup()
    renderImport(client)
    await user.upload(screen.getByLabelText('Archive package'), packageFile())

    await screen.findByRole('heading', { name: 'Errors importing archive' })
    expect(document.body).toHaveTextContent(
      /Archive format 0.3.0; this app imports 0.4.1/i,
    )
    expect(document.body).toHaveTextContent(/export is outdated/i)
    expect(document.body).not.toHaveTextContent(/Update the app/i)
  })

  it('names both people when another person’s archive needs approval', async () => {
    const { client } = stubClient({
      inspectionResult: ok({
        ...READY_INSPECTION,
        outcome: 'needsResolution',
        context: {
          ...READY_INSPECTION.context,
          sourceSubjectName: 'Sam',
          destinationSubjectName: 'Alex',
        },
        planId: 'other-person-plan',
        issues: [
          {
            issueId: 'other-person',
            code: 'differentArchive',
            severity: 'warning',
            category: 'identity',
            disposition: 'requiresDecision',
            causeCode: null,
            field: 'archiveIdentity.id',
            path: null,
            line: null,
            recordKind: null,
            id: null,
            allowedResolutions: ['preserveDestination'],
          },
        ],
      }),
    })
    const user = userEvent.setup()
    renderImport(client)
    await user.upload(screen.getByLabelText('Archive package'), packageFile())

    expect(
      await screen.findByRole('heading', { name: 'Issues importing archive' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Choose how to resolve issues')).toBeInTheDocument()
    expect(document.body).toHaveTextContent(
      'This archive belongs to Sam. The open archive belongs to Alex.',
    )
  })

  it('rejects an unsupported outer file before inspection', async () => {
    const user = userEvent.setup({ applyAccept: false })
    const { client, inspectImport, importArchive } = stubClient()
    renderImport(client)

    await user.upload(
      screen.getByLabelText('Archive package'),
      packageFile('Selected.zip', 'application/zip'),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /ending in .lifearchive.tar/i,
    )
    expect(inspectImport).not.toHaveBeenCalled()
    expect(importArchive).not.toHaveBeenCalled()
  })

  it('describes inspection failures as read-only', async () => {
    const { client, importArchive } = stubClient({
      inspectionResult: failed(failure('invalidArchive')),
    })
    const user = userEvent.setup()
    renderImport(client)
    await user.upload(screen.getByLabelText('Archive package'), packageFile())

    expect(
      await screen.findByRole('heading', {
        name: 'The package could not be checked',
      }),
    ).toBeInTheDocument()
    expect(document.body).toHaveTextContent(/check was read-only/i)
    expect(importArchive).not.toHaveBeenCalled()
  })

  it('does not claim the previous archive is unchanged after an unknown durable outcome', async () => {
    const { client } = stubClient({
      importResult: failed(
        failure('archiveTransportFailure', {
          retryable: true,
          durableOutcome: 'unknown',
        }),
      ),
    })
    await selectAndImport(client)

    expect(
      await screen.findByRole('heading', {
        name: 'Check the archive before continuing',
      }),
    ).toBeInTheDocument()
    expect(document.body).toHaveTextContent(/lost the final result/i)
    expect(document.body).not.toHaveTextContent(/still open/i)
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull()
  })

  it('requests cancellation for only the active apply operation', async () => {
    let settle:
      ((result: ClientResult<ArchiveImportResult>) => void) | undefined
    const pending = new Promise<ClientResult<ArchiveImportResult>>(
      (resolve) => {
        settle = resolve
      },
    )
    const { client, requestCancel } = stubClient({ importResult: pending })
    const user = await selectAndImport(client)

    await user.click(screen.getByRole('button', { name: 'Cancel import' }))
    expect(requestCancel).toHaveBeenCalledWith(OPERATION_ID)
    expect(document.body).toHaveTextContent(/waiting for a final result/i)
    settle?.(failed(failure('cancelled')))
    expect(await screen.findByRole('alert')).toHaveTextContent(/cancelled/i)
  })

  it('renders a useful final report without exposing an unknown issue code', async () => {
    const { client } = stubClient({
      importResult: ok({
        ...RESULT,
        issues: [
          {
            code: 'private-record-taxonomy',
            causeCode: 'invalidDate',
            field: 'date',
            path: 'entries/bad.json',
            line: 7,
            recordKind: 'entry',
            id: ITEM_ID,
          },
        ],
        identity: {
          outcome: 'merged',
          filledFields: ['archiveName'],
          conflictingFields: ['displayName'],
        },
      }),
    })
    await selectAndImport(client)

    const report = await screen.findByText('One reported issue')
    await userEvent.setup().click(report)
    const details = report.closest('details')
    expect(details).not.toBeNull()
    expect(
      within(details as HTMLElement).getByText('entries/bad.json'),
    ).toBeInTheDocument()
    expect(details).toHaveTextContent(/includes an issue/i)
    expect(details).toHaveTextContent('Line 7')
    expect(details).not.toHaveTextContent('private-record-taxonomy')
  })
})
