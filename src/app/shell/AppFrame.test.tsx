import { StrictMode } from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { I18nProvider } from '../../i18n'
import { setClientMedia } from '../../test/clientMedia'
import { AppFrame } from './AppFrame'
import { APPEARANCE_ATTRIBUTE, APPEARANCE_STORAGE_KEY } from './appearance'
import { AppearanceProvider } from './AppearanceProvider'
import { WorkspaceLayout } from './WorkspaceLayout'

function renderShell(children: React.ReactNode, navigation?: React.ReactNode) {
  return render(
    <StrictMode>
      <I18nProvider locale="en">
        <AppearanceProvider>
          <AppFrame navigation={navigation}>{children}</AppFrame>
        </AppearanceProvider>
      </I18nProvider>
    </StrictMode>,
  )
}

const workspaceOf = (container: HTMLElement): HTMLElement => {
  const workspace = container.querySelector<HTMLElement>('.workspace')
  if (!workspace) throw new Error('no workspace rendered')
  return workspace
}

beforeEach(() => {
  globalThis.localStorage.clear()
  document.documentElement.removeAttribute(APPEARANCE_ATTRIBUTE)
})

describe('the frame', () => {
  it('names the application without taking the view s heading', () => {
    renderShell(<h1>Record</h1>)
    expect(screen.getByText('LifeArchive')).toBeInTheDocument()
    expect(screen.getAllByRole('heading')).toHaveLength(1)
  })

  it('shows main navigation only when it is given some', () => {
    const { unmount } = renderShell(<p>Body</p>)
    expect(screen.queryByRole('navigation')).toBeNull()
    unmount()

    renderShell(<p>Body</p>, <nav aria-label="Main" />)
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument()
  })

  it('offers a first-tab shortcut to the main landmark', async () => {
    const user = userEvent.setup()
    renderShell(
      <WorkspaceLayout>
        <h1>Record</h1>
      </WorkspaceLayout>,
    )

    await user.tab()
    const skip = screen.getByRole('link', { name: 'Skip to main content' })
    expect(skip).toHaveFocus()
    expect(skip).toHaveAttribute('href', '#main-content')
    expect(document.querySelector('main#main-content')).toBeInTheDocument()
  })
})

describe('the appearance control', () => {
  it('cycles the appearance and says which one is in force', async () => {
    const user = userEvent.setup()
    renderShell(<p>Body</p>)

    const control = screen.getByRole('button', { name: 'Appearance: System' })
    expect(document.documentElement.getAttribute(APPEARANCE_ATTRIBUTE)).toBe(
      'system',
    )

    await user.click(control)
    expect(
      screen.getByRole('button', { name: 'Appearance: Light' }),
    ).toBeInTheDocument()
    expect(document.documentElement.getAttribute(APPEARANCE_ATTRIBUTE)).toBe(
      'light',
    )

    await user.click(screen.getByRole('button', { name: 'Appearance: Light' }))
    expect(document.documentElement.getAttribute(APPEARANCE_ATTRIBUTE)).toBe(
      'dark',
    )

    await user.click(screen.getByRole('button', { name: 'Appearance: Dark' }))
    expect(document.documentElement.getAttribute(APPEARANCE_ATTRIBUTE)).toBe(
      'system',
    )
  })

  it('remembers the choice for the next visit', async () => {
    const user = userEvent.setup()
    const { unmount } = renderShell(<p>Body</p>)
    await user.click(screen.getByRole('button', { name: 'Appearance: System' }))
    expect(globalThis.localStorage.getItem(APPEARANCE_STORAGE_KEY)).toBe(
      'light',
    )
    unmount()

    renderShell(<p>Body</p>)
    expect(
      screen.getByRole('button', { name: 'Appearance: Light' }),
    ).toBeInTheDocument()
  })

  it('keeps the visible word inside the accessible name', () => {
    renderShell(<p>Body</p>)
    const control = screen.getByRole('button', { name: 'Appearance: System' })
    expect(within(control).getByText('System')).toBeInTheDocument()
  })
})

describe('the staged workspace regions', () => {
  it('offers no drawer when the view has only a primary surface', () => {
    const { container } = renderShell(
      <WorkspaceLayout>
        <h1>Record</h1>
      </WorkspaceLayout>,
    )

    const workspace = workspaceOf(container)
    expect(workspace.dataset.navigation).toBe('none')
    expect(workspace.dataset.details).toBe('none')
    expect(screen.queryByRole('button', { name: 'Navigation' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Details' })).toBeNull()
  })

  it('names each region it is given and its toggle', () => {
    const { container } = renderShell(
      <WorkspaceLayout navigation={<p>Days</p>} details={<p>Facts</p>}>
        <h1>Record</h1>
      </WorkspaceLayout>,
    )

    const workspace = workspaceOf(container)
    expect(workspace.dataset.navigation).toBe('available')
    expect(workspace.dataset.details).toBe('available')

    for (const region of ['Navigation', 'Details']) {
      expect(
        screen.getByRole('complementary', { name: region }),
      ).toBeInTheDocument()
      expect(screen.getByRole('button', { name: region })).toHaveAttribute(
        'aria-expanded',
        'false',
      )
    }
    expect(screen.getByRole('button', { name: 'Navigation' })).toHaveAttribute(
      'aria-controls',
      'workspace-navigation',
    )
  })

  it('opens one region at a time', async () => {
    setClientMedia('(max-width: 820px)', '(max-width: 1120px)')
    const user = userEvent.setup()
    const { container } = renderShell(
      <WorkspaceLayout navigation={<p>Days</p>} details={<p>Facts</p>}>
        <h1>Record</h1>
      </WorkspaceLayout>,
    )
    const workspace = workspaceOf(container)

    await user.click(screen.getByRole('button', { name: 'Navigation' }))
    expect(workspace.dataset.open).toBe('navigation')
    expect(screen.getByRole('dialog', { name: 'Navigation' })).toHaveAttribute(
      'aria-modal',
      'true',
    )
    expect(
      screen.getByRole('button', { name: 'Close Navigation' }),
    ).toHaveFocus()

    await user.click(screen.getByRole('button', { name: 'Details' }))
    expect(workspace.dataset.open).toBe('details')
    expect(screen.getByRole('button', { name: 'Navigation' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )

    await user.click(screen.getByRole('button', { name: 'Details' }))
    expect(workspace.dataset.open).toBe('none')
  })

  it('closes the open region from the region itself', async () => {
    setClientMedia('(max-width: 1120px)')
    const user = userEvent.setup()
    const { container } = renderShell(
      <WorkspaceLayout details={<p>Facts</p>}>
        <h1>Record</h1>
      </WorkspaceLayout>,
    )
    const workspace = workspaceOf(container)

    const toggle = screen.getByRole('button', { name: 'Details' })
    await user.click(toggle)
    expect(workspace.dataset.open).toBe('details')

    await user.click(screen.getByRole('button', { name: 'Close Details' }))
    expect(workspace.dataset.open).toBe('none')
    await waitFor(() => expect(toggle).toHaveFocus())
  })

  it('cannot leave a region open once the view stops offering it', async () => {
    setClientMedia('(max-width: 1120px)')
    const user = userEvent.setup()
    const { container, rerender } = render(
      <StrictMode>
        <I18nProvider locale="en">
          <AppearanceProvider>
            <AppFrame>
              <WorkspaceLayout details={<p>Facts</p>}>
                <h1>Record</h1>
              </WorkspaceLayout>
            </AppFrame>
          </AppearanceProvider>
        </I18nProvider>
      </StrictMode>,
    )

    await user.click(screen.getByRole('button', { name: 'Details' }))
    expect(workspaceOf(container).dataset.open).toBe('details')

    rerender(
      <StrictMode>
        <I18nProvider locale="en">
          <AppearanceProvider>
            <AppFrame>
              <WorkspaceLayout>
                <h1>Record</h1>
              </WorkspaceLayout>
            </AppFrame>
          </AppearanceProvider>
        </I18nProvider>
      </StrictMode>,
    )

    expect(workspaceOf(container).dataset.open).toBe('none')
    expect(screen.queryByRole('button', { name: 'Details' })).toBeNull()
  })
})
