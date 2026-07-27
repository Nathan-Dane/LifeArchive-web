import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import {
  clientFailure,
  failed,
  ok,
  type ArchiveVerifyRequest,
  type ArchiveVerification,
  type ClientResult,
  type LifeArchiveClient,
} from '../../../core/client'
import { I18nProvider } from '../../../i18n'
import {
  ARCHIVE_TRANSPORT_EXTENSION,
  ARCHIVE_TRANSPORT_MIME_TYPE,
} from '../../../platform/files/archiveTransfer'
import { ArchiveVerifyPanel } from './ArchiveVerifyPanel'

function packageFile(size = 3): File {
  const file = new File(
    [new Uint8Array(size)],
    `Selected${ARCHIVE_TRANSPORT_EXTENSION}`,
    { type: ARCHIVE_TRANSPORT_MIME_TYPE },
  )
  Object.defineProperty(file, 'stream', {
    configurable: true,
    value: () => new ReadableStream<Uint8Array>(),
  })
  return file
}

function clientFor(result: ClientResult<ArchiveVerification>) {
  const verify = vi.fn<
    (
      request: ArchiveVerifyRequest,
    ) => Promise<ClientResult<ArchiveVerification>>
  >(() => Promise.resolve(result))
  return {
    client: { archive: { verify } } as unknown as LifeArchiveClient,
    verify,
  }
}

async function selectAndVerify(
  client: LifeArchiveClient,
  file = packageFile(),
) {
  const user = userEvent.setup()
  render(
    <I18nProvider locale="en">
      <p>Open archive remains visible</p>
      <ArchiveVerifyPanel client={client} />
    </I18nProvider>,
  )
  await user.upload(screen.getByLabelText('Archive package to verify'), file)
  await user.click(screen.getByRole('button', { name: 'Verify archive' }))
}

describe('standalone archive verification', () => {
  it('reports a valid package from the core without opening or mutating the store', async () => {
    const { client, verify } = clientFor(
      ok({ valid: true, issues: [], checkedFiles: 42 }),
    )
    const file = packageFile()
    await selectAndVerify(client, file)

    expect(
      await screen.findByRole('heading', { name: 'Archive verified' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/42 files were checked/i)).toBeInTheDocument()
    expect(screen.getByText(/were not changed/i)).toBeInTheDocument()
    expect(verify).toHaveBeenCalledWith({ archive: file })
  })

  it('reports invalid packages without exposing private issue paths or codes', async () => {
    const { client } = clientFor(
      ok({
        valid: false,
        checkedFiles: 3,
        issues: [
          { code: 'private-checksum-code', path: 'private/archive/path' },
        ],
      }),
    )
    await selectAndVerify(client)

    expect(
      await screen.findByRole('heading', { name: 'Archive not valid' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(/one integrity issue/i)
    expect(document.body).not.toHaveTextContent('private-checksum-code')
    expect(document.body).not.toHaveTextContent('private/archive/path')
    expect(screen.getByText('Open archive remains visible')).toBeInTheDocument()
  })

  it('explains an unsupported newer package as a read-only failure', async () => {
    const { client } = clientFor(
      failed(
        clientFailure({
          area: 'archive',
          code: 'newerArchiveVersion',
          phase: 'snapshot',
          retryable: false,
        }),
      ),
    )
    await selectAndVerify(client)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /newer archive format/i,
    )
    expect(screen.getByText(/were not changed/i)).toBeInTheDocument()
  })

  it('passes a large opaque package through unchanged', async () => {
    const { client, verify } = clientFor(
      ok({ valid: true, issues: [], checkedFiles: 9 }),
    )
    const file = packageFile(12 * 1024 * 1024 + 7)
    await selectAndVerify(client, file)

    await screen.findByRole('heading', { name: 'Archive verified' })
    expect(verify.mock.calls[0]?.[0].archive).toBe(file)
    expect(verify.mock.calls[0]?.[0].archive.size).toBe(12 * 1024 * 1024 + 7)
  })
})
