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
  type OrdinarySaveResult,
  type TimeWindow,
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
        developmentMock
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

function saved(
  request: Parameters<LifeArchiveClient['record']['save']>[0],
  nextRevision = '3',
): OrdinarySaveResult {
  return {
    outcome: request.target.expectation === 'absent' ? 'created' : 'updated',
    entry: {
      id:
        request.target.expectation === 'absent'
          ? request.target.newEntryId
          : request.target.entryId,
      revision: revision(nextRevision),
      window: request.window,
      markdown: request.markdown,
      plainText: request.markdown,
      createdAtMs: request.nowMs,
      updatedAtMs: request.nowMs,
      isPinned: false,
      privacy: 'normal',
      source: 'manual',
    },
    invalidation: {
      ...INVALIDATION,
      revision: revision(nextRevision),
    },
  }
}

function deferred<Value>() {
  let resolve!: (value: Value) => void
  const promise = new Promise<Value>((settle) => {
    resolve = settle
  })
  return { promise, resolve }
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

  it('autosaves existing ordinary writing with its loaded revision', async () => {
    const source = 'Café\u00a0  text\n\n日本語\tremains'
    const loaded = entry(source)
    if (loaded.presence !== 'present') throw new Error('Expected entry')
    const save = vi.fn<LifeArchiveClient['record']['save']>(async (request) =>
      ok(saved(request)),
    )
    const base = client([ok(loaded)])
    const realClient: LifeArchiveClient = {
      ...base,
      record: { ...base.record, save },
    }

    render(
      <I18nProvider locale="en">
        <MarkdownEditor client={realClient} window={WINDOW} selected={null} />
      </I18nProvider>,
    )
    const textbox = await screen.findByRole('textbox', {
      name: 'Writing editor',
    })
    await screen.findByText('Ready to save.')
    const user = userEvent.setup()
    await user.click(textbox)
    await user.paste(' revision-safe')

    await screen.findByText('Saved.')
    expect(save).toHaveBeenCalledOnce()
    expect(save.mock.calls[0]?.[0]).toMatchObject({
      window: WINDOW,
      markdown: expect.stringContaining('revision-safe'),
      target: {
        expectation: 'existing',
        entryId: loaded.entry.id,
        expectedRevision: loaded.entry.revision,
      },
    })
  })

  it('does not create an absent ordinary entry until edited writing is saved', async () => {
    const absent: OrdinaryEntryState = {
      presence: 'absent',
      window: WINDOW,
      invalidation: INVALIDATION,
    }
    const base = client([ok(absent)])
    const save = vi.fn<LifeArchiveClient['record']['save']>(async (request) =>
      ok<OrdinarySaveResult>({
        outcome: 'created',
        entry: {
          id:
            request.target.expectation === 'absent'
              ? request.target.newEntryId
              : request.target.entryId,
          revision: revision('1'),
          window: WINDOW,
          markdown: request.markdown,
          plainText: request.markdown,
          createdAtMs: request.nowMs,
          updatedAtMs: request.nowMs,
          isPinned: false,
          privacy: 'normal',
          source: 'manual',
        },
        invalidation: {
          ...INVALIDATION,
          revision: revision('2'),
        },
      }),
    )
    const realClient: LifeArchiveClient = {
      ...base,
      record: { ...base.record, save },
    }
    const user = userEvent.setup()
    render(
      <I18nProvider locale="en">
        <MarkdownEditor client={realClient} window={WINDOW} selected={null} />
      </I18nProvider>,
    )
    const textbox = await screen.findByRole('textbox', {
      name: 'Writing editor',
    })
    await screen.findByText('Ready to save.')
    expect(save).not.toHaveBeenCalled()

    await user.click(textbox)
    await user.paste('Café 日本語')
    await screen.findByText('Unsaved changes.')

    await screen.findByText('Saved.')
    expect(save).toHaveBeenCalledTimes(1)
    expect(save.mock.calls[0]?.[0]).toMatchObject({
      markdown: 'Café 日本語',
      target: { expectation: 'absent' },
    })
  })

  it('debounces rapid typing into one exact save', async () => {
    const save = vi.fn<LifeArchiveClient['record']['save']>(async (request) =>
      ok(saved(request)),
    )
    const base = client([ok(entry('start'))])
    const realClient: LifeArchiveClient = {
      ...base,
      record: { ...base.record, save },
    }
    const user = userEvent.setup()
    render(
      <I18nProvider locale="en">
        <MarkdownEditor client={realClient} window={WINDOW} selected={null} />
      </I18nProvider>,
    )
    const textbox = await screen.findByRole('textbox', {
      name: 'Writing editor',
    })
    await user.click(textbox)
    await user.paste(' one')
    await user.paste(' two')
    await user.paste(' three')

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1), {
      timeout: 2_000,
    })
    expect(save.mock.calls[0]?.[0].markdown).toContain('one two three')
    await screen.findByText('Saved.')
  })

  it('keeps failed writing and retries the same exact buffer', async () => {
    const failure = clientFailure({
      area: 'transport',
      code: 'workerLost',
      phase: 'transport',
      retryable: true,
    })
    let calls = 0
    const save = vi.fn<LifeArchiveClient['record']['save']>(async (request) => {
      calls += 1
      return calls === 1 ? failed(failure) : ok(saved(request))
    })
    const base = client([ok(entry('before'))])
    const realClient: LifeArchiveClient = {
      ...base,
      record: { ...base.record, save },
    }
    const user = userEvent.setup()
    render(
      <I18nProvider locale="en">
        <MarkdownEditor client={realClient} window={WINDOW} selected={null} />
      </I18nProvider>,
    )
    const textbox = await screen.findByRole('textbox', {
      name: 'Writing editor',
    })
    await user.click(textbox)
    await user.paste(' exact draft')
    await screen.findByRole('button', { name: 'Try saving again' })
    expect(textbox).toHaveTextContent('before')
    expect(textbox).toHaveTextContent('exact draft')

    await user.click(screen.getByRole('button', { name: 'Try saving again' }))
    await screen.findByText('Saved.')
    expect(save).toHaveBeenCalledTimes(2)
    expect(save.mock.calls[1]?.[0].markdown).toBe(
      save.mock.calls[0]?.[0].markdown,
    )
  })

  it('shows the current conflict snapshot and never merges automatically', async () => {
    const current = entry('archive version')
    if (current.presence !== 'present') throw new Error('Expected entry')
    const save = vi.fn<LifeArchiveClient['record']['save']>(async (request) =>
      ok<OrdinarySaveResult>({
        outcome: 'conflict',
        conflict: {
          expectedRevision:
            request.target.expectation === 'existing'
              ? request.target.expectedRevision
              : revision('0'),
          actualRevision: revision('9'),
          current: {
            presence: 'present',
            window: WINDOW,
            entry: { ...current.entry, revision: revision('9') },
          },
        },
      }),
    )
    const base = client([ok(entry('my start'))])
    const realClient: LifeArchiveClient = {
      ...base,
      record: { ...base.record, save },
    }
    const user = userEvent.setup()
    render(
      <I18nProvider locale="en">
        <MarkdownEditor client={realClient} window={WINDOW} selected={null} />
      </I18nProvider>,
    )
    const textbox = await screen.findByRole('textbox', {
      name: 'Writing editor',
    })
    await user.click(textbox)
    await user.paste(' kept locally')
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('archive version')
    expect(textbox).toHaveTextContent('my start')
    expect(textbox).toHaveTextContent('kept locally')
    expect(textbox).not.toHaveTextContent('archive version')
    expect(screen.getByRole('status')).toHaveTextContent('archive changed')

    await user.click(
      screen.getByRole('button', { name: 'Use archive writing' }),
    )
    await waitFor(() => expect(textbox).toHaveTextContent('archive version'))
    expect(textbox).not.toHaveTextContent('kept locally')
    expect(save).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('status')).toHaveTextContent('Ready to save')
  })

  it('reports an offline runtime without attempting a save', async () => {
    const save = vi.fn<LifeArchiveClient['record']['save']>()
    const base = client([ok(entry('before'))])
    const realClient: LifeArchiveClient = {
      ...base,
      runtime: {
        ...base.runtime,
        status: () => ({ state: 'unavailable', reason: 'worker-lost' }),
      },
      record: { ...base.record, save },
    }
    const user = userEvent.setup()
    render(
      <I18nProvider locale="en">
        <MarkdownEditor client={realClient} window={WINDOW} selected={null} />
      </I18nProvider>,
    )
    const textbox = await screen.findByRole('textbox', {
      name: 'Writing editor',
    })
    await user.click(textbox)
    await user.paste(' remains here')

    await screen.findByText(/archive runtime is offline/i)
    expect(textbox).toHaveTextContent('before')
    expect(textbox).toHaveTextContent('remains here')
    expect(save).not.toHaveBeenCalled()
  })

  it('flushes on pagehide and on unmount', async () => {
    const save = vi.fn<LifeArchiveClient['record']['save']>(async (request) =>
      ok(saved(request)),
    )
    const base = client([ok(entry('before'))])
    const realClient: LifeArchiveClient = {
      ...base,
      record: { ...base.record, save },
    }
    const user = userEvent.setup()
    const view = render(
      <I18nProvider locale="en">
        <MarkdownEditor client={realClient} window={WINDOW} selected={null} />
      </I18nProvider>,
    )
    const textbox = await screen.findByRole('textbox', {
      name: 'Writing editor',
    })
    await user.click(textbox)
    await user.paste(' pagehide')
    window.dispatchEvent(new Event('pagehide'))
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1))

    await user.paste(' unmount')
    view.unmount()
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2))
    expect(save.mock.calls[1]?.[0].markdown).toContain('pagehide unmount')
  })

  it('warns before reload and flushes when the page becomes hidden', async () => {
    const save = vi.fn<LifeArchiveClient['record']['save']>(async (request) =>
      ok(saved(request)),
    )
    const base = client([ok(entry('before'))])
    const realClient: LifeArchiveClient = {
      ...base,
      record: { ...base.record, save },
    }
    const user = userEvent.setup()
    render(
      <I18nProvider locale="en">
        <MarkdownEditor client={realClient} window={WINDOW} selected={null} />
      </I18nProvider>,
    )
    const textbox = await screen.findByRole('textbox', {
      name: 'Writing editor',
    })
    await user.click(textbox)
    await user.paste(' pending')

    const reload = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(reload)
    expect(reload.defaultPrevented).toBe(true)

    const visibility = vi
      .spyOn(document, 'visibilityState', 'get')
      .mockReturnValue('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1))
    visibility.mockRestore()
  })

  it('keeps the route and exact buffer when its pre-navigation flush fails', async () => {
    const failure = clientFailure({
      area: 'record',
      code: 'busyRetryable',
      phase: 'mutation',
      retryable: true,
    })
    const save = vi.fn<LifeArchiveClient['record']['save']>(async () =>
      failed(failure),
    )
    const route = vi.fn()
    const base = client([ok(entry('before'))])
    const realClient: LifeArchiveClient = {
      ...base,
      record: { ...base.record, save },
    }
    const user = userEvent.setup()
    render(
      <I18nProvider locale="en">
        <MarkdownEditor client={realClient} window={WINDOW} selected={null} />
        <a href="/settings" onClick={route}>
          Leave Record
        </a>
      </I18nProvider>,
    )
    const textbox = await screen.findByRole('textbox', {
      name: 'Writing editor',
    })
    await user.click(textbox)
    await user.paste(' exact route draft')
    await user.click(screen.getByRole('link', { name: 'Leave Record' }))

    await screen.findByRole('button', { name: 'Try saving again' })
    expect(route).not.toHaveBeenCalled()
    expect(textbox).toHaveTextContent('exact route draft')
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('ignores a late save response after the editor navigates away', async () => {
    const secondWindow = coreWindow('day', '2025-06-15')
    const pending =
      deferred<Awaited<ReturnType<LifeArchiveClient['record']['save']>>>()
    const save = vi.fn<LifeArchiveClient['record']['save']>(
      async () => pending.promise,
    )
    const base = client([ok(entry('first')), ok(entry('second'))])
    const realClient: LifeArchiveClient = {
      ...base,
      record: {
        ...base.record,
        load: async (requested: TimeWindow) =>
          ok(entry(requested.id === WINDOW.id ? 'first' : 'second')),
        save,
      },
    }
    const user = userEvent.setup()
    const view = render(
      <I18nProvider locale="en">
        <MarkdownEditor client={realClient} window={WINDOW} selected={null} />
      </I18nProvider>,
    )
    const textbox = await screen.findByRole('textbox', {
      name: 'Writing editor',
    })
    await user.click(textbox)
    await user.paste(' in flight')
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1), {
      timeout: 2_000,
    })

    view.rerender(
      <I18nProvider locale="en">
        <MarkdownEditor
          client={realClient}
          window={secondWindow}
          selected={null}
        />
      </I18nProvider>,
    )
    const secondTextbox = await screen.findByRole('textbox', {
      name: 'Writing editor',
    })
    await waitFor(() => expect(secondTextbox).toHaveTextContent('second'))
    pending.resolve(ok(saved(save.mock.calls[0]![0])))
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Ready to save'),
    )
    expect(secondTextbox).toHaveTextContent('second')
    expect(secondTextbox).not.toHaveTextContent('in flight')
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
