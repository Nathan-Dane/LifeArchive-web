import {
  $createLinkNode,
  $isLinkNode,
  $toggleLink,
  LinkNode,
  TOGGLE_LINK_COMMAND,
} from '@lexical/link'
import {
  $isListNode,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  ListItemNode,
  ListNode,
  REMOVE_LIST_COMMAND,
} from '@lexical/list'
import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
  BOLD_ITALIC_STAR,
  BOLD_STAR,
  HEADING,
  ITALIC_STAR,
  LINK,
  ORDERED_LIST,
  QUOTE,
  UNORDERED_LIST,
  type Transformer,
} from '@lexical/markdown'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin'
import { ListPlugin } from '@lexical/react/LexicalListPlugin'
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import {
  $createHeadingNode,
  $createQuoteNode,
  $isHeadingNode,
  $isQuoteNode,
  HeadingNode,
  QuoteNode,
} from '@lexical/rich-text'
import { $setBlocksType } from '@lexical/selection'
import {
  $createParagraphNode,
  $createTextNode,
  $getSelection,
  $isRangeSelection,
  CAN_REDO_COMMAND,
  CAN_UNDO_COMMAND,
  COMMAND_PRIORITY_LOW,
  FORMAT_TEXT_COMMAND,
  KEY_DOWN_COMMAND,
  REDO_COMMAND,
  SELECTION_CHANGE_COMMAND,
  UNDO_COMMAND,
  $setSelection,
  type EditorState,
  type LexicalEditor,
  type LexicalNode,
  type RangeSelection,
  type TextFormatType,
} from 'lexical'
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent,
} from 'react'
import { useTranslate } from '../../../i18n'
import { RecordControlIcon, RecordOverlay } from '../overlays'
import { EditorIcon, type EditorIconName } from './EditorIcon'

interface MarkdownWritingSurfaceProps {
  readonly value: string
  readonly disabled: boolean
  readonly onChange: (markdown: string) => void
}

type BlockStyle = 'paragraph' | 'headingTwo' | 'headingThree'
type ListStyle = 'bullet' | 'number' | null

interface ToolbarState {
  readonly canUndo: boolean
  readonly canRedo: boolean
  readonly block: BlockStyle
  readonly list: ListStyle
  readonly bold: boolean
  readonly italic: boolean
  readonly quote: boolean
  readonly link: boolean
}

const EMPTY_TOOLBAR_STATE: ToolbarState = {
  canUndo: false,
  canRedo: false,
  block: 'paragraph',
  list: null,
  bold: false,
  italic: false,
  quote: false,
  link: false,
}

/*
 * Keep the visual vocabulary narrower than Lexical's playground. Markdown is
 * the durable interchange format; the open editor is always a visual document.
 */
const MARKDOWN_TRANSFORMERS: Transformer[] = [
  HEADING,
  QUOTE,
  UNORDERED_LIST,
  ORDERED_LIST,
  BOLD_ITALIC_STAR,
  BOLD_STAR,
  ITALIC_STAR,
  LINK,
]

const EDITOR_THEME = {
  paragraph: 'record-editor__paragraph',
  heading: {
    h1: 'record-editor__heading record-editor__heading--one',
    h2: 'record-editor__heading record-editor__heading--two',
    h3: 'record-editor__heading record-editor__heading--three',
    h4: 'record-editor__heading record-editor__heading--three',
    h5: 'record-editor__heading record-editor__heading--three',
    h6: 'record-editor__heading record-editor__heading--three',
  },
  quote: 'record-editor__quote',
  list: {
    listitem: 'record-editor__list-item',
    ol: 'record-editor__ordered-list',
    ul: 'record-editor__unordered-list',
  },
  link: 'record-editor__link',
  text: {
    bold: 'record-editor__bold',
    italic: 'record-editor__italic',
  },
}

function safeLinkUrl(url: string) {
  const value = url.trim()
  if (value.length === 0) return null
  try {
    const parsed = new URL(value, window.location.origin)
    return ['http:', 'https:', 'mailto:'].includes(parsed.protocol)
      ? value
      : null
  } catch {
    return null
  }
}

function nearestLink(node: LexicalNode | null) {
  let current = node
  while (current) {
    if ($isLinkNode(current)) return current
    current = current.getParent()
  }
  return null
}

function currentToolbarState(
  editorState: EditorState,
  canUndo: boolean,
  canRedo: boolean,
): ToolbarState {
  return editorState.read(() => {
    const selection = $getSelection()
    if (!$isRangeSelection(selection)) {
      return { ...EMPTY_TOOLBAR_STATE, canUndo, canRedo }
    }

    const anchor = selection.anchor.getNode()
    const topLevel =
      anchor.getKey() === 'root' ? null : anchor.getTopLevelElementOrThrow()
    const heading = $isHeadingNode(topLevel) ? topLevel.getTag() : null
    const list = $isListNode(topLevel)
      ? topLevel.getListType() === 'number'
        ? 'number'
        : 'bullet'
      : null

    return {
      canUndo,
      canRedo,
      block:
        heading === 'h1' || heading === 'h2'
          ? 'headingTwo'
          : heading
            ? 'headingThree'
            : 'paragraph',
      list,
      bold: selection.hasFormat('bold'),
      italic: selection.hasFormat('italic'),
      quote: $isQuoteNode(topLevel),
      link: nearestLink(anchor) !== null,
    }
  })
}

function EditablePlugin({ disabled }: { readonly disabled: boolean }) {
  const [editor] = useLexicalComposerContext()
  useEffect(() => {
    editor.setEditable(!disabled)
  }, [disabled, editor])
  return null
}

function MarkdownChangePlugin({
  onChange,
}: {
  readonly onChange: (markdown: string) => void
}) {
  const handleChange = useCallback(
    (editorState: EditorState) => {
      const markdown = editorState.read(() =>
        $convertToMarkdownString(MARKDOWN_TRANSFORMERS),
      )
      onChange(markdown)
    },
    [onChange],
  )
  return (
    <OnChangePlugin
      ignoreSelectionChange
      ignoreHistoryMergeTagChange
      onChange={handleChange}
    />
  )
}

function MarkdownValuePlugin({ value }: { readonly value: string }) {
  const [editor] = useLexicalComposerContext()
  useEffect(() => {
    const current = editor
      .getEditorState()
      .read(() => $convertToMarkdownString(MARKDOWN_TRANSFORMERS))
    if (current === value) return
    editor.update(() => {
      $convertFromMarkdownString(value, MARKDOWN_TRANSFORMERS)
    })
  }, [editor, value])
  return null
}

function ToolbarPlugin({ disabled }: { readonly disabled: boolean }) {
  const t = useTranslate()
  const [editor] = useLexicalComposerContext()
  const [state, setState] = useState(EMPTY_TOOLBAR_STATE)
  const [blockMenuOpen, setBlockMenuOpen] = useState(false)
  const [linkPanelOpen, setLinkPanelOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState('https://')
  const [linkError, setLinkError] = useState(false)
  const linkSelection = useRef<RangeSelection | null>(null)
  const blockButton = useRef<HTMLButtonElement>(null)
  const blockOptions = useRef<(HTMLButtonElement | null)[]>([])
  const linkButton = useRef<HTMLButtonElement>(null)
  const linkInput = useRef<HTMLInputElement>(null)
  const linkPanelId = useId()
  const linkHeadingId = useId()
  const linkErrorId = useId()
  const blockMenuId = useId()
  const blockButtonId = useId()

  useEffect(() => {
    let canUndo = false
    let canRedo = false
    const refresh = (nextState = editor.getEditorState()) => {
      setState(currentToolbarState(nextState, canUndo, canRedo))
    }
    const unregisterUpdate = editor.registerUpdateListener(
      ({ editorState }) => {
        refresh(editorState)
      },
    )
    const unregisterSelection = editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        refresh()
        return false
      },
      COMMAND_PRIORITY_LOW,
    )
    const unregisterUndo = editor.registerCommand(
      CAN_UNDO_COMMAND,
      (available) => {
        canUndo = available
        refresh()
        return false
      },
      COMMAND_PRIORITY_LOW,
    )
    const unregisterRedo = editor.registerCommand(
      CAN_REDO_COMMAND,
      (available) => {
        canRedo = available
        refresh()
        return false
      },
      COMMAND_PRIORITY_LOW,
    )
    refresh()
    return () => {
      unregisterUpdate()
      unregisterSelection()
      unregisterUndo()
      unregisterRedo()
    }
  }, [editor])

  const openLinkPanel = useCallback(() => {
    if (state.link) {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, null)
      editor.focus()
      return
    }
    editor.getEditorState().read(() => {
      const selection = $getSelection()
      linkSelection.current = $isRangeSelection(selection)
        ? selection.clone()
        : null
    })
    setLinkUrl('https://')
    setLinkError(false)
    setLinkPanelOpen(true)
  }, [editor, state.link])

  function applyLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const url = safeLinkUrl(linkUrl)
    if (!url) {
      setLinkError(true)
      return
    }
    editor.update(() => {
      if (linkSelection.current) {
        $setSelection(linkSelection.current.clone())
      }
      const selection = $getSelection()
      if (!$isRangeSelection(selection)) return
      if (selection.isCollapsed()) {
        const link = $createLinkNode(url, { rel: 'noreferrer' })
        const label = $createTextNode(t('record.editor.linkPlaceholder'))
        link.append(label)
        selection.insertNodes([link])
        label.select(0, label.getTextContentSize())
      } else {
        $toggleLink({
          url,
          rel: 'noreferrer',
        })
      }
    })
    setLinkPanelOpen(false)
    setLinkError(false)
  }

  useEffect(() => {
    return editor.registerCommand(
      KEY_DOWN_COMMAND,
      (event) => {
        if (
          event.isComposing ||
          !(event.ctrlKey || event.metaKey) ||
          event.altKey
        ) {
          return false
        }
        const key = event.key.toLowerCase()
        if (key === 'k' && !event.shiftKey) {
          event.preventDefault()
          openLinkPanel()
          return true
        }
        if (event.shiftKey && key === '7') {
          event.preventDefault()
          editor.dispatchCommand(
            state.list === 'number'
              ? REMOVE_LIST_COMMAND
              : INSERT_ORDERED_LIST_COMMAND,
            undefined,
          )
          return true
        }
        if (event.shiftKey && key === '8') {
          event.preventDefault()
          editor.dispatchCommand(
            state.list === 'bullet'
              ? REMOVE_LIST_COMMAND
              : INSERT_UNORDERED_LIST_COMMAND,
            undefined,
          )
          return true
        }
        return false
      },
      COMMAND_PRIORITY_LOW,
    )
  }, [editor, openLinkPanel, state.list])

  function applyBlock(block: BlockStyle) {
    editor.update(() => {
      const selection = $getSelection()
      if (!$isRangeSelection(selection)) return
      $setBlocksType(selection, () =>
        block === 'headingTwo'
          ? $createHeadingNode('h2')
          : block === 'headingThree'
            ? $createHeadingNode('h3')
            : $createParagraphNode(),
      )
    })
    editor.focus()
  }

  const blockStyles: readonly {
    readonly value: BlockStyle
    readonly label: string
  }[] = [
    { value: 'paragraph', label: t('record.editor.paragraph') },
    { value: 'headingTwo', label: t('record.editor.headingTwo') },
    { value: 'headingThree', label: t('record.editor.headingThree') },
  ]
  const currentBlockLabel =
    blockStyles.find(({ value }) => value === state.block)?.label ??
    blockStyles[0]!.label
  const closeBlockMenu = (restoreFocus = true) => {
    setBlockMenuOpen(false)
    if (restoreFocus) {
      globalThis.queueMicrotask(() => blockButton.current?.focus())
    }
  }
  const openBlockMenu = (focusSelected: boolean) => {
    setBlockMenuOpen(true)
    if (!focusSelected) return
    const selectedIndex = blockStyles.findIndex(
      ({ value }) => value === state.block,
    )
    globalThis.queueMicrotask(() =>
      blockOptions.current[Math.max(selectedIndex, 0)]?.focus(),
    )
  }
  const moveBlockFocus = (direction: 1 | -1) => {
    const current = blockOptions.current.indexOf(
      document.activeElement as HTMLButtonElement,
    )
    const next =
      current < 0
        ? direction > 0
          ? 0
          : blockStyles.length - 1
        : (current + direction + blockStyles.length) % blockStyles.length
    blockOptions.current[next]?.focus()
  }

  function toggleQuote() {
    editor.update(() => {
      const selection = $getSelection()
      if (!$isRangeSelection(selection)) return
      $setBlocksType(selection, () =>
        state.quote ? $createParagraphNode() : $createQuoteNode(),
      )
    })
    editor.focus()
  }

  function toolbarKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    const controls = [
      ...event.currentTarget.querySelectorAll<HTMLElement>(
        'button:not(:disabled)',
      ),
    ]
    const current = controls.indexOf(document.activeElement as HTMLElement)
    if (current === -1) return
    event.preventDefault()
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? controls.length - 1
          : event.key === 'ArrowLeft'
            ? (current - 1 + controls.length) % controls.length
            : (current + 1) % controls.length
    controls[next]?.focus()
  }

  function keepEditorSelection(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault()
  }

  function formatText(format: TextFormatType) {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, format)
    editor.focus()
  }

  function toolbarButton(
    icon: EditorIconName,
    label: string,
    title: string,
    action: () => void,
    pressed?: boolean,
    isDisabled = false,
  ) {
    return (
      <button
        type="button"
        aria-label={label}
        aria-pressed={pressed}
        title={title}
        disabled={disabled || isDisabled}
        onMouseDown={keepEditorSelection}
        onClick={action}
      >
        <EditorIcon name={icon} />
      </button>
    )
  }

  return (
    <>
      <div
        className="record-editor__toolbar"
        role="toolbar"
        aria-label={t('record.editor.toolbar')}
        onKeyDown={toolbarKeyDown}
      >
        {toolbarButton(
          'undo',
          t('record.editor.undo'),
          t('record.editor.undoShortcut'),
          () => {
            editor.dispatchCommand(UNDO_COMMAND, undefined)
            editor.focus()
          },
          undefined,
          !state.canUndo,
        )}
        {toolbarButton(
          'redo',
          t('record.editor.redo'),
          t('record.editor.redoShortcut'),
          () => {
            editor.dispatchCommand(REDO_COMMAND, undefined)
            editor.focus()
          },
          undefined,
          !state.canRedo,
        )}
        <span className="record-editor__toolbar-separator" aria-hidden="true" />
        <button
          id={blockButtonId}
          ref={blockButton}
          type="button"
          className="record-editor__block-style"
          aria-label={t('record.editor.blockStyle')}
          aria-haspopup="menu"
          aria-expanded={blockMenuOpen}
          aria-controls={blockMenuId}
          disabled={disabled}
          onMouseDown={keepEditorSelection}
          onClick={(event) =>
            blockMenuOpen
              ? closeBlockMenu(false)
              : openBlockMenu(event.detail === 0)
          }
        >
          <span>{currentBlockLabel}</span>
          <RecordControlIcon name="expand" />
        </button>
        <RecordOverlay
          id={blockMenuId}
          open={blockMenuOpen}
          kind="menu"
          labelledBy={blockButtonId}
          anchorRef={blockButton}
          onClose={closeBlockMenu}
          className="record-menu record-editor__block-menu"
        >
          <div
            className="record-menu__items record-editor__block-menu-items"
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
                event.preventDefault()
                moveBlockFocus(1)
              } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
                event.preventDefault()
                moveBlockFocus(-1)
              } else if (event.key === 'Home' || event.key === 'End') {
                event.preventDefault()
                const index = event.key === 'Home' ? 0 : blockStyles.length - 1
                blockOptions.current[index]?.focus()
              }
            }}
          >
            {blockStyles.map((option, index) => (
              <button
                key={option.value}
                ref={(element) => {
                  blockOptions.current[index] = element
                }}
                type="button"
                className="record-menu__item"
                role="menuitemradio"
                aria-checked={state.block === option.value}
                onClick={() => {
                  setBlockMenuOpen(false)
                  applyBlock(option.value)
                }}
              >
                <span>{option.label}</span>
                <span className="record-editor__block-menu-check" aria-hidden>
                  {state.block === option.value ? (
                    <RecordControlIcon name="check" />
                  ) : null}
                </span>
              </button>
            ))}
          </div>
        </RecordOverlay>
        <span className="record-editor__toolbar-separator" aria-hidden="true" />
        {toolbarButton(
          'bold',
          t('record.editor.bold'),
          t('record.editor.boldShortcut'),
          () => formatText('bold'),
          state.bold,
        )}
        {toolbarButton(
          'italic',
          t('record.editor.italic'),
          t('record.editor.italicShortcut'),
          () => formatText('italic'),
          state.italic,
        )}
        <span className="record-editor__toolbar-separator" aria-hidden="true" />
        {toolbarButton(
          'bullet-list',
          t('record.editor.list'),
          t('record.editor.listShortcut'),
          () => {
            editor.dispatchCommand(
              state.list === 'bullet'
                ? REMOVE_LIST_COMMAND
                : INSERT_UNORDERED_LIST_COMMAND,
              undefined,
            )
            editor.focus()
          },
          state.list === 'bullet',
        )}
        {toolbarButton(
          'ordered-list',
          t('record.editor.orderedList'),
          t('record.editor.orderedListShortcut'),
          () => {
            editor.dispatchCommand(
              state.list === 'number'
                ? REMOVE_LIST_COMMAND
                : INSERT_ORDERED_LIST_COMMAND,
              undefined,
            )
            editor.focus()
          },
          state.list === 'number',
        )}
        {toolbarButton(
          'quote',
          t('record.editor.quote'),
          t('record.editor.quote'),
          toggleQuote,
          state.quote,
        )}
        <span className="record-editor__toolbar-separator" aria-hidden="true" />
        <button
          ref={linkButton}
          type="button"
          aria-label={
            state.link ? t('record.editor.unlink') : t('record.editor.link')
          }
          aria-pressed={state.link}
          aria-haspopup="dialog"
          aria-expanded={linkPanelOpen}
          aria-controls={linkPanelId}
          title={t('record.editor.linkShortcut')}
          disabled={disabled}
          onMouseDown={keepEditorSelection}
          onClick={openLinkPanel}
        >
          <EditorIcon name="link" />
        </button>
      </div>
      <RecordOverlay
        id={linkPanelId}
        open={linkPanelOpen}
        kind="anchored"
        labelledBy={linkHeadingId}
        anchorRef={linkButton}
        initialFocusRef={linkInput}
        onClose={() => setLinkPanelOpen(false)}
        className="record-editor__link-popup"
      >
        <form className="record-editor__link-panel" onSubmit={applyLink}>
          <h2 id={linkHeadingId} className="visually-hidden">
            {t('record.editor.linkDialog')}
          </h2>
          <label>
            <span>{t('record.editor.linkAddress')}</span>
            <input
              ref={linkInput}
              type="url"
              value={linkUrl}
              aria-invalid={linkError}
              aria-describedby={linkError ? linkErrorId : undefined}
              onChange={(event) => {
                setLinkUrl(event.currentTarget.value)
                setLinkError(false)
              }}
            />
          </label>
          {linkError ? (
            <span
              id={linkErrorId}
              className="record-editor__link-error"
              role="alert"
            >
              {t('record.editor.linkInvalid')}
            </span>
          ) : null}
          <div className="record-editor__link-actions">
            <button type="submit" className="button">
              {t('record.editor.linkApply')}
            </button>
            <button
              type="button"
              className="button"
              onClick={() => setLinkPanelOpen(false)}
            >
              {t('record.editor.linkCancel')}
            </button>
          </div>
        </form>
      </RecordOverlay>
    </>
  )
}

export function MarkdownWritingSurface({
  value,
  disabled,
  onChange,
}: MarkdownWritingSurfaceProps) {
  const t = useTranslate()
  const initialConfig = useMemo(
    () => ({
      namespace: 'LifeArchiveWriting',
      editable: !disabled,
      nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode, LinkNode],
      theme: EDITOR_THEME,
      editorState: () => {
        $convertFromMarkdownString(value, MARKDOWN_TRANSFORMERS)
      },
      onError(error: Error, editor: LexicalEditor) {
        editor.setEditable(false)
        throw error
      },
    }),
    // The parent keys this surface by exact destination. Lexical is
    // intentionally uncontrolled after that one import.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  return (
    <div className="record-editor__surface">
      <LexicalComposer initialConfig={initialConfig}>
        <ToolbarPlugin disabled={disabled} />
        <div className="record-editor__writing">
          <RichTextPlugin
            contentEditable={
              <ContentEditable
                className="record-editor__content"
                aria-label={t('record.editor.source')}
                aria-multiline="true"
                aria-placeholder={t('record.editor.placeholder')}
                placeholder={
                  <div
                    className="record-editor__placeholder"
                    aria-hidden="true"
                  >
                    {t('record.editor.placeholder')}
                  </div>
                }
                spellCheck
              />
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
        </div>
        <HistoryPlugin />
        <ListPlugin />
        <LinkPlugin
          validateUrl={(url) => safeLinkUrl(url) !== null}
          attributes={{ rel: 'noreferrer' }}
        />
        <MarkdownChangePlugin onChange={onChange} />
        <MarkdownValuePlugin value={value} />
        <EditablePlugin disabled={disabled} />
      </LexicalComposer>
    </div>
  )
}
