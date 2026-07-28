import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import {
  clientFailure,
  failed,
  ok,
  revision,
  stableId,
  type LifeArchiveClient,
  type OrdinaryEntryState,
} from '../../../core/client'
import { I18nProvider } from '../../../i18n'
import { TestLifeArchiveClient } from '../../../test/TestLifeArchiveClient'
import { coreWindow } from '../../../test/timeFixtures'
import { MarkdownEditor } from './MarkdownEditor'
import { MarkdownWritingSurface } from './MarkdownWritingSurface'

const WINDOW = coreWindow('day', '2025-06-14')
const INVALIDATION = {
  storeInstanceId: 'editor-test',
  revision: revision('1'),
}
const ARCHIVE = {
  storeId: stableId('7f1c0a10-0000-4000-8000-000000000001'),
  productContract: 'test',
  storeSchemaVersion: 'test',
  rootLayoutVersion: 'test',
  invalidation: INVALIDATION,
}

function entry(markdown: string): OrdinaryEntryState {
  return {
    presence: 'present',
    window: WINDOW,
    entry: {
      id: stableId('7f1c0a10-0000-4000-8000-000000000010'),
      revision: revision('2'),
      window: WINDOW,
      markdown,
      plainText: markdown,
      createdAtMs: 0,
      updatedAtMs: 0,
      isPinned: false,
      privacy: 'normal',
      source: 'manual',
    },
    invalidation: INVALIDATION,
  }
}

function client(
  loads: readonly ReturnType<typeof ok<OrdinaryEntryState>>[],
): LifeArchiveClient {
  const base = new TestLifeArchiveClient({
    state: 'open',
    archive: ARCHIVE,
  }).client
  let call = 0
  return {
    ...base,
    record: {
      ...base.record,
      load: async () => loads[call++] ?? loads.at(-1)!,
    },
  }
}

function editor(source: string) {
  return render(
    <I18nProvider locale="en">
      <MarkdownEditor
        client={client([ok(entry(source))])}
        window={WINDOW}
        selected={null}
      />
    </I18nProvider>,
  )
}

function selectText(textbox: HTMLElement, start: number, end: number) {
  const text = document
    .createTreeWalker(textbox, NodeFilter.SHOW_TEXT)
    .nextNode()
  if (!(text instanceof Text)) throw new Error('Expected paragraph text')
  act(() => {
    const range = document.createRange()
    range.setStart(text, start)
    range.setEnd(text, end)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
    document.dispatchEvent(new Event('selectionchange'))
  })
}

describe('MarkdownEditor', () => {
  it('imports Markdown as visual Unicode writing without source punctuation', async () => {
    const source =
      '## Café\u00a0\n\n**日本語** and *visuelt*\n\n- one\n- two\n\n> quote'
    editor(source)
    const textbox = await screen.findByRole('textbox', {
      name: 'Writing editor',
    })

    await waitFor(() => expect(textbox).toHaveTextContent('Café'))
    expect(textbox).toHaveTextContent('日本語')
    expect(textbox).not.toHaveTextContent('##')
    expect(textbox).not.toHaveTextContent('**')
    expect(
      screen.getByRole('heading', { name: /Café/, level: 2 }),
    ).toBeInTheDocument()
    expect(textbox.querySelector('.record-editor__bold')).toHaveTextContent(
      '日本語',
    )
    expect(textbox.querySelector('.record-editor__italic')).toHaveTextContent(
      'visuelt',
    )
    expect(textbox.querySelector('ul')).toHaveTextContent('onetwo')
    expect(textbox.querySelector('blockquote')).toHaveTextContent('quote')
    expect(screen.getAllByRole('status')).toHaveLength(1)
    expect(screen.getByRole('status')).toHaveTextContent('Development preview')
    expect(screen.getByRole('status')).not.toHaveTextContent(/\bsaved\b/i)
  })

  it('formats a whitespace-bounded selection visually with the shortcut and undo', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <I18nProvider locale="en">
        <MarkdownWritingSurface
          value="before bold after"
          disabled={false}
          onChange={onChange}
        />
      </I18nProvider>,
    )
    const textbox = await screen.findByRole('textbox', {
      name: 'Writing editor',
    })
    await waitFor(() =>
      expect(textbox).toHaveAttribute('contenteditable', 'true'),
    )

    selectText(textbox, 6, 12)
    fireEvent.keyDown(textbox, { key: 'b', ctrlKey: true })
    await waitFor(() =>
      expect(onChange).toHaveBeenLastCalledWith('before **bold** after'),
    )
    expect(textbox.querySelector('.record-editor__bold')).toHaveTextContent(
      'bold',
    )
    expect(textbox).toHaveTextContent('before bold after')
    expect(textbox).not.toHaveTextContent('**')

    await user.click(screen.getByRole('button', { name: 'Undo' }))
    await waitFor(() =>
      expect(onChange).toHaveBeenLastCalledWith('before bold after'),
    )
    await user.click(screen.getByRole('button', { name: 'Redo' }))
    await waitFor(() =>
      expect(onChange).toHaveBeenLastCalledWith('before **bold** after'),
    )
  })

  it('applies the visual toolbar controls and a safe link without showing syntax', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <I18nProvider locale="en">
        <MarkdownWritingSurface
          value="click me"
          disabled={false}
          onChange={onChange}
        />
      </I18nProvider>,
    )
    const textbox = await screen.findByRole('textbox', {
      name: 'Writing editor',
    })

    selectText(textbox, 0, 5)
    await user.click(screen.getByRole('button', { name: 'Bold' }))
    await waitFor(() =>
      expect(textbox.querySelector('.record-editor__bold')).toHaveTextContent(
        'click',
      ),
    )

    selectText(textbox, 0, 5)
    await user.click(screen.getByRole('button', { name: 'Italic' }))
    await waitFor(() =>
      expect(textbox.querySelector('.record-editor__italic')).toHaveTextContent(
        'click',
      ),
    )

    selectText(textbox, 0, 5)
    await user.click(screen.getByRole('button', { name: 'Link' }))
    const address = screen.getByRole('textbox', { name: 'Web address' })
    await user.clear(address)
    await user.type(address, 'https://example.com/writing')
    await user.click(screen.getByRole('button', { name: 'Apply link' }))
    const link = await screen.findByRole('link', { name: 'click' })
    expect(link).toHaveAttribute('href', 'https://example.com/writing')

    selectText(textbox, 0, 5)
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Text style' }),
      'headingTwo',
    )
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
      'click me',
    )

    selectText(textbox, 0, 5)
    await user.click(screen.getByRole('button', { name: 'Bulleted list' }))
    await waitFor(() => expect(textbox.querySelector('ul')).toBeInTheDocument())
    expect(textbox).not.toHaveTextContent(/[*#[\]()]/)
    expect(onChange).toHaveBeenCalled()
  })

  it('pastes Unicode into the visual document and exports Markdown', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const source = 'Café\u00a0  \n日本語\n\n'
    render(
      <I18nProvider locale="en">
        <MarkdownWritingSurface
          value={source}
          disabled={false}
          onChange={onChange}
        />
      </I18nProvider>,
    )
    const textbox = await screen.findByRole('textbox', {
      name: 'Writing editor',
    })
    await user.click(textbox)
    await user.paste('pasted\ttext  \n')
    await waitFor(() => expect(textbox).toHaveTextContent('pasted'))
    expect(textbox).toHaveTextContent('Café')
    expect(textbox).toHaveTextContent('日本語')
    expect(onChange).toHaveBeenCalled()
  })

  it('does not run formatting shortcuts during IME composition', async () => {
    const onChange = vi.fn()
    render(
      <I18nProvider locale="en">
        <MarkdownWritingSurface value="" disabled={false} onChange={onChange} />
      </I18nProvider>,
    )
    const textbox = await screen.findByRole('textbox', {
      name: 'Writing editor',
    })
    fireEvent.compositionStart(textbox)
    fireEvent.keyDown(textbox, {
      key: 'b',
      ctrlKey: true,
      isComposing: true,
    })
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.compositionEnd(textbox, { data: '日本' })
  })

  it('keeps the buffer through a scripted load failure and retry', async () => {
    const failure = clientFailure({
      area: 'record',
      code: 'busyRetryable',
      phase: 'snapshot',
      retryable: true,
    })
    const base = new TestLifeArchiveClient({
      state: 'open',
      archive: ARCHIVE,
    }).client
    let calls = 0
    const scripted: LifeArchiveClient = {
      ...base,
      record: {
        ...base.record,
        load: async () => {
          calls += 1
          return calls === 1 ? failed(failure) : ok(entry('recovered'))
        },
      },
    }
    render(
      <I18nProvider locale="en">
        <MarkdownEditor client={scripted} window={WINDOW} selected={null} />
      </I18nProvider>,
    )
    const textbox = await screen.findByRole('textbox', {
      name: 'Writing editor',
    })
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'editor buffer was kept',
      ),
    )
    const user = userEvent.setup()
    await user.click(textbox)
    await user.paste('local draft')
    expect(textbox).toHaveTextContent('local draft')
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Try reading again' }))
    await waitFor(() => expect(textbox).toHaveTextContent('local draft'))
    expect(textbox).not.toHaveTextContent('recovered')
  })

  it('renders HTML and unsafe links only as editable text', async () => {
    editor(
      '<img src=x onerror=alert(1)>\n\n[run](javascript:alert(1))\n\n**safe**',
    )
    const textbox = await screen.findByRole('textbox', {
      name: 'Writing editor',
    })
    await waitFor(() => expect(textbox).toHaveTextContent('<img src=x'))
    expect(textbox.querySelector('img[src]')).toBeNull()
    expect(textbox.querySelector('script')).toBeNull()
    expect(screen.queryByRole('link', { name: 'run' })).toBeNull()
    expect(textbox).toHaveTextContent('run')
    expect(textbox).toHaveTextContent('safe')
  })
})
