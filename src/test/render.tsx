import { render, type RenderResult } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import type { AppBootstrap } from '../core/bootstrap'
import { AppShell } from '../app/AppShell'
import { AppStateProvider } from '../app/providers/AppStateProvider'
import { AppearanceProvider } from '../app/shell'
import { revision, stableId } from '../core/client'
import { I18nProvider } from '../i18n'
import { TestLifeArchiveClient } from './TestLifeArchiveClient'

export interface RenderAppOptions {
  /** The locale for dates, numbers, and plurals. Copy stays English. */
  readonly locale?: string
  /**
   * Rendered inside the router, beside the application. For tests that watch
   * the location itself — a feature that puts an exact identifier in the URL
   * has to be checked against the URL, not only against what it draws.
   */
  readonly within?: ReactNode
}

/**
 * Renders the composed application at a path. Tests opt into a fixed open mock
 * by default; production never does so.
 */
export function renderAppAt(
  path: string,
  bootstrap: AppBootstrap = async () => ({
    state: 'client',
    client: new TestLifeArchiveClient({
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
  { locale, within }: RenderAppOptions = {},
): RenderResult {
  return render(
    <AppearanceProvider>
      <I18nProvider locale={locale}>
        <MemoryRouter initialEntries={[path]}>
          <AppStateProvider bootstrap={bootstrap}>
            <AppShell />
          </AppStateProvider>
          {within}
        </MemoryRouter>
      </I18nProvider>
    </AppearanceProvider>,
  )
}
