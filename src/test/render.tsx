import { render, type RenderResult } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { AppBootstrap } from '../core/bootstrap'
import { AppShell } from '../app/AppShell'
import { AppStateProvider } from '../app/providers/AppStateProvider'
import { revision, stableId } from '../core/client'
import { FakeLifeArchiveClient } from './FakeLifeArchiveClient'

/**
 * Renders the composed application at a path. Tests opt into a fixed open mock
 * by default; production never does so.
 */
export function renderAppAt(
  path: string,
  bootstrap: AppBootstrap = async () => ({
    state: 'client',
    client: new FakeLifeArchiveClient({
      state: 'open',
      archive: {
        storeId: stableId('7f1c0a10-0000-4000-8000-000000000001'),
        productContract: 'test',
        storeSchemaVersion: 'test',
        rootLayoutVersion: 'test',
        invalidation: {
          storeInstanceId: 'test',
          revision: revision('1'),
        },
      },
    }).client,
    developmentMock: true,
  }),
): RenderResult {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppStateProvider bootstrap={bootstrap}>
        <AppShell />
      </AppStateProvider>
    </MemoryRouter>,
  )
}
