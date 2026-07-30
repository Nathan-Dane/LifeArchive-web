import { StrictMode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { I18nProvider } from '../../i18n'
import { setClientMedia } from '../../test/clientMedia'
import { AppFrame } from './AppFrame'
import { APPEARANCE_ATTRIBUTE } from './appearance'
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

describe('the staged workspace regions', () => {
  it('hides a workspace scrollbar shortly after scrolling stops', async () => {
    renderShell(
      <WorkspaceLayout>
        <h1>Record</h1>
      </WorkspaceLayout>,
    )
    const main = document.querySelector<HTMLElement>('.workspace__content')
    if (!main) throw new Error('no main scroller rendered')
    const overlay = document.querySelector<HTMLElement>(
      '[data-scrollbar-for="content"]',
    )
    if (!overlay) throw new Error('no main scrollbar overlay rendered')

    Object.defineProperties(main, {
      clientHeight: { configurable: true, value: 100 },
      scrollHeight: { configurable: true, value: 400 },
      scrollTop: { configurable: true, value: 100 },
    })
    main.getBoundingClientRect = () =>
      ({
        bottom: 110,
        height: 100,
        left: 20,
        right: 220,
        top: 10,
        width: 200,
        x: 20,
        y: 10,
        toJSON: () => undefined,
      }) as DOMRect

    fireEvent.scroll(main)
    expect(main).toHaveAttribute('data-scrollbar-visible', 'true')
    expect(overlay).toHaveAttribute('data-visible', 'true')
    expect(overlay.style.height).toBe('24px')
    await waitFor(
      () => {
        expect(main).not.toHaveAttribute('data-scrollbar-visible')
        expect(overlay).toHaveAttribute('data-visible', 'false')
      },
      { timeout: 700 },
    )
  })

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
