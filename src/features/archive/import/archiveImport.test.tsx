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
const PRIVATE_ISSUE_ID = stableId('7f1c0a10-0000-4000-8000-000000000099')
const RESULT: ArchiveImportResult = {
  importedEntries: 12,
  importedMedia: 3,
  skippedEntries: 2,
  skippedMedia: 1,
  skippedEntryIds: [PRIVATE_ISSUE_ID],
  skippedMediaIds: [],
  issues: [
    {
      code: 'private-record-taxonomy',
      recordKind: 'entry',
      id: PRIVATE_ISSUE_ID,
    },
  ],
  identity: {
    outcome: 'filled',
    unchangedFields: ['displayName'],
  },
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

function failure(code: string, retryable = false): ClientFailure {
  return clientFailure({
    area: 'archive',
    code,
    phase: 'mutation',
    retryable,
    durableOutcome: 'known',
  })
}

function stubClient(
  importResult:
    | ClientResult<ArchiveImportResult>
    | Promise<ClientResult<ArchiveImportResult>> = ok(RESULT),
) {
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
    archive: { import: importArchive },
    operations: {
      newOperationId: () => OPERATION_ID,
      requestCancel,
    },
  } as unknown as LifeArchiveClient
  return { client, importArchive, requestCancel }
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

async function selectAndImport(client: LifeArchiveClient) {
  const user = userEvent.setup()
  renderImport(client)
  await user.upload(screen.getByLabelText('Archive package'), packageFile())
  await user.click(screen.getByRole('button', { name: 'Import archive' }))
  return user
}

describe('atomic archive import', () => {
  it('hands one opaque package and scoped operation ID to the client', async () => {
    const { client, importArchive } = stubClient()
    await selectAndImport(client)

    expect(
      await screen.findByRole('heading', { name: 'Import complete' }),
    ).toBeInTheDocument()
    expect(importArchive).toHaveBeenCalledOnce()
    expect(importArchive).toHaveBeenCalledWith({
      operationId: OPERATION_ID,
      archive: expect.any(File),
    })
  })

  it('reports imported, duplicate, invalid, and identity-conflict counts without private taxonomy', async () => {
    const { client } = stubClient()
    await selectAndImport(client)

    const result = await screen.findByRole('heading', {
      name: 'Import complete',
    })
    const region = result.closest('.archive-import')
    expect(region).not.toBeNull()
    expect(within(region as HTMLElement).getByText('12')).toBeInTheDocument()
    expect(within(region as HTMLElement).getByText('3')).toBeInTheDocument()
    expect(within(region as HTMLElement).getByText('2')).toBeInTheDocument()
    expect(document.body).toHaveTextContent(/one invalid item was skipped/i)
    expect(document.body).toHaveTextContent(
      /one existing identity detail was kept/i,
    )
    expect(document.body).not.toHaveTextContent('private-record-taxonomy')
    expect(document.body).not.toHaveTextContent(PRIVATE_ISSUE_ID)
  })

  it('reports a definitive no-op', async () => {
    const { client } = stubClient(
      ok({
        ...RESULT,
        importedEntries: 0,
        importedMedia: 0,
        skippedEntries: 0,
        skippedMedia: 0,
        skippedEntryIds: [],
        issues: [],
        identity: { outcome: 'preserved' },
      }),
    )
    await selectAndImport(client)

    expect(
      await screen.findByRole('heading', { name: 'Nothing new to import' }),
    ).toBeInTheDocument()
    expect(document.body).toHaveTextContent(/made no changes/i)
  })

  it('rejects an unsupported outer file before calling the client', async () => {
    const user = userEvent.setup({ applyAccept: false })
    const { client, importArchive } = stubClient()
    renderImport(client)

    await user.upload(
      screen.getByLabelText('Archive package'),
      packageFile('Selected.zip', 'application/zip'),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /ending in .lifearchive.tar/i,
    )
    expect(importArchive).not.toHaveBeenCalled()
  })

  it.each([
    ['invalid package', 'invalidArchive'],
    ['newer version', 'newerArchiveVersion'],
    ['checksum failure', 'checksumMismatch'],
    ['media failure', 'missingMedia'],
  ])('keeps the prior archive visible after %s', async (_case, code) => {
    const { client } = stubClient(failed(failure(code)))
    await selectAndImport(client)

    expect(
      await screen.findByRole('heading', {
        name: 'The archive was not imported',
      }),
    ).toBeInTheDocument()
    expect(screen.getByText('Previously open archive')).toBeInTheDocument()
    expect(document.body).toHaveTextContent(/still open/i)
    expect(document.body).not.toHaveTextContent(code)
    expect(screen.queryByText(/empty replacement/i)).toBeNull()
  })

  it('states a different archive identity explicitly', async () => {
    const { client } = stubClient(failed(failure('differentArchive')))
    await selectAndImport(client)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /different archive identity/i,
    )
    expect(document.body).toHaveTextContent(/was not applied/i)
  })

  it('requests cancellation for only the active operation and waits for its outcome', async () => {
    let settle:
      ((result: ClientResult<ArchiveImportResult>) => void) | undefined
    const pending = new Promise<ClientResult<ArchiveImportResult>>(
      (resolve) => {
        settle = resolve
      },
    )
    const { client, requestCancel } = stubClient(pending)
    const user = await selectAndImport(client)

    await user.click(screen.getByRole('button', { name: 'Cancel import' }))
    expect(requestCancel).toHaveBeenCalledOnce()
    expect(requestCancel).toHaveBeenCalledWith(OPERATION_ID)
    expect(document.body).toHaveTextContent(/waiting for a final result/i)
    expect(screen.getByRole('button', { name: 'Cancel import' })).toBeDisabled()

    settle?.(failed(failure('cancelled')))
    expect(await screen.findByRole('alert')).toHaveTextContent(/cancelled/i)
    expect(screen.getByText('Previously open archive')).toBeInTheDocument()
  })

  it('returns to a clean import view after apply and remount without showing an empty archive', async () => {
    const { client } = stubClient()
    const view = renderImport(client)
    const user = userEvent.setup()
    await user.upload(screen.getByLabelText('Archive package'), packageFile())
    await user.click(screen.getByRole('button', { name: 'Import archive' }))
    await screen.findByRole('heading', { name: 'Import complete' })

    view.unmount()
    renderImport(client)
    expect(
      screen.getByRole('heading', { name: 'Import an archive' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Previously open archive')).toBeInTheDocument()
    expect(screen.queryByText(/empty archive/i)).toBeNull()
  })
})
