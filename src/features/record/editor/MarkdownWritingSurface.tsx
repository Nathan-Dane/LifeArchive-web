import { exec as pellExec, init as initPell } from 'pell'
import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
} from 'react'
import { useTranslate } from '../../../i18n'
import { useMenuRovingFocus } from '../../../ui/menu'
import { RecordControlIcon, RecordOverlay } from '../../../ui/overlay'
import {
  decodeEditorDom,
  decodeMarkdown,
  encodeMarkdown,
  renderEditorFragment,
  safeLinkUrl,
} from '../../markdown/markdownCodec'
import { EditorIcon, type EditorIconName } from './EditorIcon'
import type { WritingSurfaceProps } from './writingSurfaceTypes'

type PressedState = boolean | 'mixed'
type BlockStyle =
  'paragraph' | 'heading' | 'subheading' | 'quote' | 'codeBlock' | 'mixed'
type EditorCommand =
  | 'undo'
  | 'redo'
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strikethrough'
  | 'inlineCode'
  | 'bulletList'
  | 'numberList'
  | 'indent'
  | 'outdent'
  | 'quote'
  | 'divider'
  | 'clear'
  | Exclude<BlockStyle, 'mixed'>

interface ToolbarState {
  readonly canUndo: boolean
  readonly canRedo: boolean
  readonly block: BlockStyle
  readonly bulletList: PressedState
  readonly numberList: PressedState
  readonly bold: PressedState
  readonly italic: PressedState
  readonly underline: PressedState
  readonly strikethrough: PressedState
  readonly inlineCode: PressedState
  readonly quote: PressedState
  readonly link: PressedState
  readonly linkUrl: string | null
}

const EMPTY_TOOLBAR_STATE: ToolbarState = {
  canUndo: false,
  canRedo: false,
  block: 'paragraph',
  bulletList: false,
  numberList: false,
  bold: false,
  italic: false,
  underline: false,
  strikethrough: false,
  inlineCode: false,
  quote: false,
  link: false,
  linkUrl: null,
}

function activeRange(root: HTMLElement) {
  const selection = root.ownerDocument.getSelection()
  if (!selection?.rangeCount) return null
  const range = selection.getRangeAt(0)
  return root.contains(range.commonAncestorContainer) ? range : null
}

function closestWithin(root: HTMLElement, node: Node | null, selector: string) {
  const element = node instanceof Element ? node : (node?.parentElement ?? null)
  const closest = element?.closest(selector) ?? null
  return closest && root.contains(closest) ? (closest as HTMLElement) : null
}

function topLevelWithin(root: HTMLElement, node: Node | null) {
  let element = node instanceof Element ? node : (node?.parentElement ?? null)
  while (element && element.parentElement !== root)
    element = element.parentElement
  return element?.parentElement === root ? (element as HTMLElement) : null
}

function selectedTextNodes(root: HTMLElement, range: Range) {
  if (range.collapsed) return range.startContainer ? [range.startContainer] : []
  const nodes: Node[] = []
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    try {
      if (range.intersectsNode(node)) nodes.push(node)
    } catch {
      // A browser may expose a transient composition node between events.
    }
  }
  return nodes.length > 0 ? nodes : [range.commonAncestorContainer]
}

function combinedState(values: readonly boolean[]): PressedState {
  if (values.length === 0 || values.every((value) => !value)) return false
  if (values.every(Boolean)) return true
  return 'mixed'
}

function selectedTopLevels(root: HTMLElement, range: Range) {
  const blocks = [...root.children].filter((element) => {
    try {
      return range.intersectsNode(element)
    } catch {
      return false
    }
  }) as HTMLElement[]
  if (blocks.length > 0) return blocks
  const closest = topLevelWithin(root, range.startContainer)
  return closest ? [closest] : []
}

function blockStyle(element: HTMLElement): Exclude<BlockStyle, 'mixed'> {
  if (element.matches('h1')) return 'heading'
  if (element.matches('h2,h3,h4,h5,h6')) return 'subheading'
  if (element.matches('blockquote')) return 'quote'
  if (element.matches('pre')) return 'codeBlock'
  return 'paragraph'
}

function commonValue<Value>(values: readonly Value[], fallback: Value) {
  return values.length > 0 && values.every((value) => value === values[0])
    ? values[0]!
    : fallback
}

function queryEnabled(ownerDocument: Document, command: string) {
  try {
    return ownerDocument.queryCommandEnabled?.(command) ?? false
  } catch {
    return false
  }
}

function readToolbarState(
  root: HTMLElement,
  fallbackUndo: boolean,
  fallbackRedo: boolean,
): ToolbarState {
  const range = activeRange(root)
  if (!range) return EMPTY_TOOLBAR_STATE
  const nodes = selectedTextNodes(root, range)
  const has = (selector: string) =>
    combinedState(
      nodes.map((node) => closestWithin(root, node, selector) !== null),
    )
  const links = nodes.map((node) =>
    closestWithin(root, node, 'a[href]')?.getAttribute('href'),
  )
  const link = combinedState(links.map(Boolean))
  const topLevels = selectedTopLevels(root, range)
  const blocks = topLevels.map(blockStyle)
  const lists = nodes.map((node) => closestWithin(root, node, 'ol,ul'))
  const quote = combinedState(
    nodes.map((node) => closestWithin(root, node, 'blockquote') !== null),
  )
  return {
    canUndo: queryEnabled(root.ownerDocument, 'undo') || fallbackUndo,
    canRedo: queryEnabled(root.ownerDocument, 'redo') || fallbackRedo,
    block: commonValue(blocks, 'mixed'),
    bulletList: combinedState(lists.map((list) => list?.tagName === 'UL')),
    numberList: combinedState(lists.map((list) => list?.tagName === 'OL')),
    bold: has('strong,b'),
    italic: has('em,i'),
    underline: has('u'),
    strikethrough: has('del,s,strike'),
    inlineCode: combinedState(
      nodes.map(
        (node) =>
          closestWithin(root, node, 'code') !== null &&
          closestWithin(root, node, 'pre') === null,
      ),
    ),
    quote,
    link,
    linkUrl:
      link === true
        ? commonValue(
            links.filter((value): value is string => Boolean(value)),
            null,
          )
        : null,
  }
}

function selectContents(node: Node) {
  const selection = node.ownerDocument?.getSelection()
  if (!selection) return
  const range = node.ownerDocument!.createRange()
  range.selectNodeContents(node)
  selection.removeAllRanges()
  selection.addRange(range)
}

function wrapSelection(root: HTMLElement, tag: string) {
  const range = activeRange(root)
  if (!range || range.collapsed) return false
  const wrapper = root.ownerDocument.createElement(tag)
  const className =
    tag === 'strong'
      ? 'record-editor__bold'
      : tag === 'em'
        ? 'record-editor__italic'
        : tag === 'u'
          ? 'record-editor__underline'
          : tag === 'del'
            ? 'record-editor__strikethrough'
            : tag === 'code'
              ? 'record-editor__code'
              : tag === 'a'
                ? 'record-editor__link'
                : ''
  if (className) wrapper.className = className
  wrapper.append(range.extractContents())
  range.insertNode(wrapper)
  selectContents(wrapper)
  return true
}

function wrapSelectionWithNativeHtml(
  root: HTMLElement,
  tag: string,
  className: string,
  execute: (command: string, value?: string) => boolean,
) {
  const range = activeRange(root)
  if (!range || range.collapsed) return false
  const staging = root.ownerDocument.createElement('div')
  staging.append(range.cloneContents())
  const walker = root.ownerDocument.createTreeWalker(
    staging,
    NodeFilter.SHOW_TEXT,
  )
  const textNodes: Text[] = []
  for (
    let node = walker.nextNode() as Text | null;
    node;
    node = walker.nextNode() as Text | null
  ) {
    if (node.data) textNodes.push(node)
  }
  for (const textNode of textNodes) {
    const wrapper = root.ownerDocument.createElement(tag)
    wrapper.className = className
    textNode.replaceWith(wrapper)
    wrapper.append(textNode)
  }
  return execute('insertHTML', staging.innerHTML)
}

function unwrapSelectionWithNativeHtml(
  root: HTMLElement,
  selector: string,
  execute: (command: string, value?: string) => boolean,
) {
  const range = activeRange(root)
  if (!range || range.collapsed) return false
  const staging = root.ownerDocument.createElement('div')
  staging.append(range.cloneContents())
  const selectedElements = [...staging.querySelectorAll<HTMLElement>(selector)]
  if (selectedElements.length > 0) {
    for (const selected of selectedElements) unwrapElement(selected)
    return execute('insertHTML', staging.innerHTML)
  }
  const element = closestWithin(root, range?.startContainer ?? null, selector)
  if (!element) return false
  selectContents(element)
  const replacement = root.ownerDocument.createElement('span')
  for (const child of element.childNodes)
    replacement.append(child.cloneNode(true))
  return execute('insertHTML', replacement.innerHTML)
}

function clearSelectionWithNativeHtml(
  root: HTMLElement,
  execute: (command: string, value?: string) => boolean,
) {
  const range = activeRange(root)
  if (!range || range.collapsed) return false
  const staging = root.ownerDocument.createElement('div')
  staging.append(range.cloneContents())
  for (const element of staging.querySelectorAll<HTMLElement>(
    'strong,b,em,i,u,del,s,strike,code,a,span,font',
  )) {
    unwrapElement(element)
  }
  return execute('insertHTML', staging.innerHTML)
}

function wrapLinkRange(root: HTMLElement, range: Range, url: string) {
  if (range.collapsed) return null
  const anchor = root.ownerDocument.createElement('a')
  anchor.className = 'record-editor__link'
  anchor.setAttribute('href', url)
  anchor.rel = 'noreferrer'
  anchor.append(range.extractContents())
  range.insertNode(anchor)
  selectContents(anchor)
  return anchor
}

function applyPresentationClasses(root: HTMLElement) {
  const classes: readonly [string, string][] = [
    ['p', 'record-editor__paragraph'],
    ['h1', 'record-editor__heading record-editor__heading--two'],
    ['h2,h3,h4,h5,h6', 'record-editor__heading record-editor__heading--three'],
    ['strong,b', 'record-editor__bold'],
    ['em,i', 'record-editor__italic'],
    ['u', 'record-editor__underline'],
    ['del,s,strike', 'record-editor__strikethrough'],
    ['a[href]', 'record-editor__link'],
    ['code:not(pre > code)', 'record-editor__code'],
    ['pre', 'record-editor__code-block'],
    ['ul', 'record-editor__unordered-list'],
    ['ol', 'record-editor__ordered-list'],
    ['li', 'record-editor__list-item'],
    ['blockquote', 'record-editor__quote'],
    ['hr', 'record-editor__divider'],
  ]
  for (const [selector, className] of classes) {
    for (const element of root.querySelectorAll<HTMLElement>(selector)) {
      element.className = className
    }
  }
}

function renameElements(root: HTMLElement, selector: string, tag: 'del' | 's') {
  const offsets = selectionOffsets(root)
  for (const element of root.querySelectorAll<HTMLElement>(selector)) {
    const replacement = root.ownerDocument.createElement(tag)
    while (element.firstChild) replacement.append(element.firstChild)
    element.replaceWith(replacement)
  }
  if (offsets) restoreOffsets(root, offsets)
}

function placeCaretAtEnd(root: HTMLElement) {
  const range = root.ownerDocument.createRange()
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let lastText: Text | null = null
  for (
    let node = walker.nextNode() as Text | null;
    node;
    node = walker.nextNode() as Text | null
  ) {
    lastText = node
  }
  if (lastText) {
    range.setStart(lastText, lastText.data.length)
    range.collapse(true)
  } else {
    const lastBlock = root.lastElementChild
    range.selectNodeContents(lastBlock ?? root)
    range.collapse(false)
  }
  const selection = root.ownerDocument.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
}

function unwrapElement(element: HTMLElement | null) {
  if (!element?.parentNode) return false
  const fragment = element.ownerDocument.createDocumentFragment()
  while (element.firstChild) fragment.append(element.firstChild)
  element.replaceWith(fragment)
  return true
}

function unwrapElementAndSelect(element: HTMLElement) {
  const parent = element.parentNode
  const first = element.firstChild
  const last = element.lastChild
  if (!parent || !first || !last) return unwrapElement(element)
  const fragment = element.ownerDocument.createDocumentFragment()
  while (element.firstChild) fragment.append(element.firstChild)
  element.replaceWith(fragment)
  const range = element.ownerDocument.createRange()
  range.setStartBefore(first)
  range.setEndAfter(last)
  const selection = element.ownerDocument.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
  return true
}

function hasMeaningfulContent(node: Node) {
  return Boolean(
    node.textContent ||
    (node instanceof Element && node.querySelector('br,hr')),
  )
}

/*
 * Browsers express "turn this semantic format off" as an inline span with a
 * visual override. Lift that exact command artifact out of the semantic tag,
 * retain any other nested traits, then remove the span. CSS never becomes a
 * persisted semantic input.
 */
function repairNativeFormatRemoval(root: HTMLElement, selector: string) {
  let repaired = false
  for (const artifact of root.querySelectorAll<HTMLElement>('span')) {
    const semantic = closestWithin(root, artifact.parentNode, selector)
    if (semantic) {
      const beforeRange = root.ownerDocument.createRange()
      beforeRange.selectNodeContents(semantic)
      beforeRange.setEndBefore(artifact)
      const afterRange = root.ownerDocument.createRange()
      afterRange.selectNodeContents(semantic)
      afterRange.setStartAfter(artifact)

      const before = semantic.cloneNode(false) as HTMLElement
      before.append(beforeRange.cloneContents())
      const after = semantic.cloneNode(false) as HTMLElement
      after.append(afterRange.cloneContents())
      let selected: Node = artifact
      for (
        let ancestor = artifact.parentElement;
        ancestor && ancestor !== semantic;
        ancestor = ancestor.parentElement
      ) {
        const wrapper = ancestor.cloneNode(false) as HTMLElement
        wrapper.append(selected)
        selected = wrapper
      }
      semantic.replaceWith(
        ...(hasMeaningfulContent(before) ? [before] : []),
        selected,
        ...(hasMeaningfulContent(after) ? [after] : []),
      )
    }
    artifact.removeAttribute('style')
    artifact.removeAttribute('class')
    repaired = unwrapElementAndSelect(artifact) || repaired
  }
  root.normalize()
  return repaired
}

function unwrapClosest(root: HTMLElement, selector: string) {
  const range = activeRange(root)
  return unwrapElement(
    closestWithin(root, range?.startContainer ?? null, selector),
  )
}

function replaceSelectedBlocks(
  root: HTMLElement,
  tag: 'p' | 'h1' | 'h2' | 'blockquote' | 'pre',
) {
  const range = activeRange(root)
  if (!range) return false
  const blocks = selectedTopLevels(root, range)
  if (blocks.length === 0) return false
  let last: HTMLElement | null = null
  for (const block of blocks) {
    if (block.tagName === tag.toUpperCase()) {
      last = block
      continue
    }
    const replacement = root.ownerDocument.createElement(tag)
    if (tag === 'pre') {
      const code = root.ownerDocument.createElement('code')
      code.textContent = block.textContent ?? ''
      replacement.append(code)
    } else if (block.tagName === 'PRE') {
      replacement.textContent = block.textContent ?? ''
    } else {
      while (block.firstChild) replacement.append(block.firstChild)
    }
    block.replaceWith(replacement)
    last = replacement
  }
  if (last) selectContents(last)
  return true
}

function setCaret(node: Node, offset: number) {
  const ownerDocument = node.ownerDocument
  const selection = ownerDocument?.getSelection()
  if (!ownerDocument || !selection) return
  const range = ownerDocument.createRange()
  range.setStart(node, offset)
  range.collapse(true)
  selection.removeAllRanges()
  selection.addRange(range)
}

function insertDivider(root: HTMLElement) {
  const range = activeRange(root)
  if (!range) return false
  range.deleteContents()
  const block = topLevelWithin(root, range.startContainer)
  const divider = root.ownerDocument.createElement('hr')
  const after = root.ownerDocument.createElement('p')
  after.append(root.ownerDocument.createElement('br'))
  if (!block?.parentNode) {
    root.append(divider, after)
  } else {
    const trailingRange = root.ownerDocument.createRange()
    trailingRange.selectNodeContents(block)
    try {
      trailingRange.setStart(range.startContainer, range.startOffset)
      const trailing = trailingRange.extractContents()
      if (trailing.textContent || trailing.childNodes.length > 0) {
        after.replaceChildren(trailing)
      }
    } catch {
      // The browser already split the selected block; an empty paragraph is safe.
    }
    block.after(divider, after)
  }
  setCaret(after, 0)
  return true
}

function insertFragment(root: HTMLElement, fragment: DocumentFragment) {
  let range = activeRange(root)
  if (!range) return false
  if (range.collapsed && range.startContainer === root) {
    const adjacent =
      root.children[Math.max(0, range.startOffset - 1)] ?? root.lastElementChild
    if (adjacent) {
      range = root.ownerDocument.createRange()
      range.selectNodeContents(adjacent)
      range.collapse(false)
    }
  }
  range.deleteContents()
  const last = fragment.lastChild
  range.insertNode(fragment)
  if (last?.parentNode) {
    const selection = root.ownerDocument.getSelection()
    range.setStartAfter(last)
    range.collapse(true)
    selection?.removeAllRanges()
    selection?.addRange(range)
  }
  return true
}

function toggleList(root: HTMLElement, kind: 'ul' | 'ol') {
  const range = activeRange(root)
  if (!range) return false
  const current = closestWithin(root, range.startContainer, 'ul,ol')
  if (current) {
    if (current.tagName.toLowerCase() !== kind) {
      const replacement = root.ownerDocument.createElement(kind)
      for (const attribute of current.attributes)
        replacement.setAttribute(attribute.name, attribute.value)
      while (current.firstChild) replacement.append(current.firstChild)
      current.replaceWith(replacement)
      selectContents(replacement)
      return true
    }
    const fragment = root.ownerDocument.createDocumentFragment()
    for (const item of [...current.children]) {
      const paragraph = root.ownerDocument.createElement('p')
      while (item.firstChild) paragraph.append(item.firstChild)
      fragment.append(paragraph)
    }
    const last = fragment.lastChild
    current.replaceWith(fragment)
    if (last) selectContents(last)
    return true
  }
  const blocks = selectedTopLevels(root, range)
  if (blocks.length === 0) return false
  const list = root.ownerDocument.createElement(kind)
  let selectedItem: HTMLLIElement | null = null
  for (const block of blocks) {
    const item = root.ownerDocument.createElement('li')
    while (block.firstChild) item.append(block.firstChild)
    list.append(item)
    selectedItem = item
  }
  blocks[0]!.replaceWith(list)
  for (const block of blocks.slice(1)) block.remove()
  if (selectedItem) selectContents(selectedItem)
  return true
}

function adjustListDepth(root: HTMLElement, inward: boolean) {
  const range = activeRange(root)
  const item = closestWithin(root, range?.startContainer ?? null, 'li')
  const list = item?.parentElement
  if (!item || !list?.matches('ul,ol')) return false
  if (inward) {
    const previous = item.previousElementSibling
    if (!(previous instanceof HTMLLIElement)) return false
    let nested = previous.lastElementChild
    if (!nested?.matches(list.tagName.toLowerCase())) {
      nested = root.ownerDocument.createElement(list.tagName.toLowerCase())
      previous.append(nested)
    }
    nested.append(item)
    selectContents(item)
    return true
  }
  const parentItem = list.parentElement
  const parentList = parentItem?.parentElement
  if (!(parentItem instanceof HTMLLIElement) || !parentList?.matches('ul,ol')) {
    return false
  }
  parentItem.after(item)
  if (list.children.length === 0) list.remove()
  selectContents(item)
  return true
}

function selectionOffsets(root: HTMLElement) {
  const range = activeRange(root)
  if (!range) return null
  const before = root.ownerDocument.createRange()
  before.selectNodeContents(root)
  before.setEnd(range.startContainer, range.startOffset)
  const selected = range.cloneRange()
  return { start: before.toString().length, length: selected.toString().length }
}

function restoreOffsets(
  root: HTMLElement,
  offsets: { readonly start: number; readonly length: number },
) {
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let consumed = 0
  let startNode: Text | null = null
  let endNode: Text | null = null
  let startOffset = 0
  let endOffset = 0
  const wantedEnd = offsets.start + offsets.length
  for (
    let node = walker.nextNode() as Text | null;
    node;
    node = walker.nextNode() as Text | null
  ) {
    const next = consumed + node.data.length
    if (!startNode && offsets.start <= next) {
      startNode = node
      startOffset = Math.max(0, offsets.start - consumed)
    }
    if (wantedEnd <= next) {
      endNode = node
      endOffset = Math.max(0, wantedEnd - consumed)
      break
    }
    consumed = next
  }
  if (!startNode) {
    root.focus()
    const range = root.ownerDocument.createRange()
    range.selectNodeContents(root)
    range.collapse(false)
    const selection = root.ownerDocument.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
    return
  }
  const range = root.ownerDocument.createRange()
  range.setStart(startNode, startOffset)
  range.setEnd(endNode ?? startNode, endNode ? endOffset : startOffset)
  const selection = root.ownerDocument.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
}

interface ToolbarProps {
  readonly disabled: boolean
  readonly state: ToolbarState
  readonly linkShortcut: number
  readonly run: (command: EditorCommand) => void
  readonly captureSelection: () => Range | null
  readonly applyLink: (url: string, selection: Range | null) => void
  readonly removeLink: (selection: Range | null) => void
}

interface ToolbarOverflowItem {
  readonly key: string
  readonly icon: EditorIconName
  readonly label: string
  readonly checked?: PressedState
  readonly onSelect: () => void
}

function ToolbarOverflowMenu({
  className,
  label,
  icon,
  disabled,
  widthRef,
  triggerRef,
  captureSelection,
  items,
}: {
  readonly className: string
  readonly label: string
  readonly icon: EditorIconName
  readonly disabled: boolean
  readonly widthRef: RefObject<HTMLElement | null>
  readonly triggerRef?: RefObject<HTMLButtonElement | null>
  readonly captureSelection: () => Range | null
  readonly items: readonly ToolbarOverflowItem[]
}) {
  const [open, setOpen] = useState(false)
  const internalTrigger = useRef<HTMLButtonElement>(null)
  const trigger = triggerRef ?? internalTrigger
  const menuId = useId()
  const triggerId = useId()
  const closeMenu = (restoreFocus: boolean) => {
    setOpen(false)
    if (restoreFocus) queueMicrotask(() => trigger.current?.focus())
  }
  const menuFocus = useMenuRovingFocus({
    wrap: true,
    onEscape: () => closeMenu(true),
    stopEscapePropagation: true,
  })
  const focusMenuItem = (fromEnd = false) => {
    const selected = items.findIndex(
      (item) => item.checked === true || item.checked === 'mixed',
    )
    const index = fromEnd ? items.length - 1 : Math.max(selected, 0)
    queueMicrotask(() => menuFocus.focus(index))
  }
  const openMenu = (focusItem: boolean, fromEnd = false) => {
    captureSelection()
    setOpen(true)
    if (focusItem) focusMenuItem(fromEnd)
  }

  return (
    <>
      <button
        id={triggerId}
        ref={trigger}
        type="button"
        className={`record-editor__overflow-trigger ${className}`}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        title={label}
        disabled={disabled}
        onPointerDown={(event) => {
          captureSelection()
          event.preventDefault()
        }}
        onClick={(event) =>
          open ? closeMenu(false) : openMenu(event.detail === 0)
        }
        onKeyDown={(event) => {
          if (!open && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
            event.preventDefault()
            openMenu(true, event.key === 'ArrowUp')
          }
        }}
      >
        <EditorIcon name={icon} />
        <RecordControlIcon name="expand" />
      </button>
      <RecordOverlay
        id={menuId}
        open={open}
        kind="menu"
        labelledBy={triggerId}
        anchorRef={trigger}
        widthRef={widthRef}
        onClose={() => closeMenu(true)}
        className="record-menu record-editor__command-menu"
      >
        <div
          className="record-menu__items record-editor__menu-items"
          onKeyDown={menuFocus.onKeyDown}
        >
          {items.map((item, index) => {
            const checkable = item.checked !== undefined
            return (
              <button
                key={item.key}
                ref={menuFocus.itemRef(index)}
                type="button"
                className="record-menu__item"
                role={checkable ? 'menuitemcheckbox' : 'menuitem'}
                aria-checked={checkable ? item.checked : undefined}
                onClick={() => {
                  setOpen(false)
                  item.onSelect()
                }}
              >
                <EditorIcon name={item.icon} />
                <span>{item.label}</span>
                <span className="record-editor__menu-check" aria-hidden>
                  {item.checked === true ? (
                    <RecordControlIcon name="check" />
                  ) : item.checked === 'mixed' ? (
                    '—'
                  ) : null}
                </span>
              </button>
            )
          })}
        </div>
      </RecordOverlay>
    </>
  )
}

function Toolbar({
  disabled,
  state,
  linkShortcut,
  run,
  captureSelection,
  applyLink,
  removeLink,
}: ToolbarProps) {
  const t = useTranslate()
  const [blockMenuOpen, setBlockMenuOpen] = useState(false)
  const [linkPanelOpen, setLinkPanelOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState('https://')
  const [linkError, setLinkError] = useState(false)
  const linkSelection = useRef<Range | null>(null)
  const pendingLinkAction = useRef<
    | {
        readonly type: 'apply'
        readonly url: string
        readonly range: Range | null
      }
    | { readonly type: 'remove'; readonly range: Range | null }
    | null
  >(null)
  const blockButton = useRef<HTMLButtonElement>(null)
  const blockOptions = useRef<(HTMLButtonElement | null)[]>([])
  const menuWidthReference = useRef<HTMLSpanElement>(null)
  const inlineMenuButton = useRef<HTMLButtonElement>(null)
  const linkButton = useRef<HTMLButtonElement>(null)
  const linkAnchor = useRef<HTMLElement>(null)
  const linkInput = useRef<HTMLInputElement>(null)
  const handledLinkShortcut = useRef(0)
  const linkPanelId = useId()
  const linkHeadingId = useId()
  const linkErrorId = useId()
  const blockMenuId = useId()
  const blockButtonId = useId()

  const openLinkPanel = useCallback(
    (anchor?: HTMLElement | null) => {
      const directLink = linkButton.current
      const directLinkVisible =
        directLink && getComputedStyle(directLink).display !== 'none'
      linkAnchor.current =
        anchor ??
        (directLinkVisible ? directLink : inlineMenuButton.current) ??
        directLink
      linkSelection.current = captureSelection()
      setLinkUrl(state.linkUrl ?? 'https://')
      setLinkError(false)
      setLinkPanelOpen(true)
    },
    [captureSelection, state.linkUrl],
  )

  useEffect(() => {
    if (linkShortcut === 0 || handledLinkShortcut.current === linkShortcut)
      return
    handledLinkShortcut.current = linkShortcut
    openLinkPanel()
  }, [linkShortcut, openLinkPanel])

  const completePendingLinkAction = useCallback(() => {
    if (!pendingLinkAction.current) return
    const pending = pendingLinkAction.current
    pendingLinkAction.current = null
    if (pending.type === 'apply') applyLink(pending.url, pending.range)
    else removeLink(pending.range)
  }, [applyLink, removeLink])

  function submitLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const url = safeLinkUrl(linkUrl)
    if (!url) {
      setLinkError(true)
      return
    }
    pendingLinkAction.current = {
      type: 'apply',
      url,
      range: linkSelection.current,
    }
    setLinkPanelOpen(false)
    setLinkError(false)
  }

  const blockStyles: readonly {
    readonly value: Exclude<BlockStyle, 'mixed'>
    readonly label: string
    readonly icon: EditorIconName
  }[] = [
    {
      value: 'paragraph',
      label: t('record.editor.paragraph'),
      icon: 'paragraph',
    },
    {
      value: 'heading',
      label: t('record.editor.headingTwo'),
      icon: 'heading',
    },
    {
      value: 'subheading',
      label: t('record.editor.headingThree'),
      icon: 'subheading',
    },
    { value: 'quote', label: t('record.editor.quote'), icon: 'quote' },
    {
      value: 'codeBlock',
      label: t('record.editor.codeBlock'),
      icon: 'code-block',
    },
  ]
  const currentBlock = blockStyles.find(({ value }) => value === state.block)
  const currentBlockLabel =
    state.block === 'mixed'
      ? t('record.editor.mixedStyle')
      : (currentBlock?.label ?? blockStyles[0]!.label)
  const currentBlockIcon = currentBlock?.icon ?? 'paragraph'
  const listMenuItems: readonly ToolbarOverflowItem[] = [
    {
      key: 'bullet-list',
      icon: 'bullet-list',
      label: t('record.editor.list'),
      checked: state.bulletList,
      onSelect: () => run('bulletList'),
    },
    {
      key: 'ordered-list',
      icon: 'ordered-list',
      label: t('record.editor.orderedList'),
      checked: state.numberList,
      onSelect: () => run('numberList'),
    },
    {
      key: 'indent',
      icon: 'indent',
      label: t('record.editor.indent'),
      onSelect: () => run('indent'),
    },
    {
      key: 'outdent',
      icon: 'outdent',
      label: t('record.editor.outdent'),
      onSelect: () => run('outdent'),
    },
  ]
  const inlineMenuItems: readonly ToolbarOverflowItem[] = [
    {
      key: 'underline',
      icon: 'underline',
      label: t('record.editor.underline'),
      checked: state.underline,
      onSelect: () => run('underline'),
    },
    {
      key: 'strikethrough',
      icon: 'strikethrough',
      label: t('record.editor.strikethrough'),
      checked: state.strikethrough,
      onSelect: () => run('strikethrough'),
    },
    {
      key: 'inline-code',
      icon: 'inline-code',
      label: t('record.editor.inlineCode'),
      checked: state.inlineCode,
      onSelect: () => run('inlineCode'),
    },
    {
      key: 'link',
      icon: 'link',
      label: t('record.editor.link'),
      onSelect: () => openLinkPanel(inlineMenuButton.current),
    },
  ]
  const closeBlockMenu = (restoreFocus = true) => {
    setBlockMenuOpen(false)
    if (restoreFocus) queueMicrotask(() => blockButton.current?.focus())
  }
  const openBlockMenu = (focusSelected: boolean) => {
    setBlockMenuOpen(true)
    if (!focusSelected) return
    const selectedIndex = blockStyles.findIndex(
      ({ value }) => value === state.block,
    )
    queueMicrotask(() =>
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

  function toolbarKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    const controls = [
      ...event.currentTarget.querySelectorAll<HTMLElement>(
        'button:not(:disabled)',
      ),
    ].filter((control) => getComputedStyle(control).display !== 'none')
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

  function keepEditorSelection(event: PointerEvent<HTMLButtonElement>) {
    captureSelection()
    event.preventDefault()
  }

  function toolbarButton(
    icon: EditorIconName,
    label: string,
    title: string,
    command: EditorCommand,
    pressed?: PressedState,
    isDisabled = false,
    className?: string,
  ) {
    return (
      <button
        type="button"
        className={className}
        aria-label={label}
        aria-pressed={pressed}
        title={title}
        disabled={disabled || isDisabled}
        onPointerDown={keepEditorSelection}
        onClick={() => run(command)}
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
        <span
          ref={menuWidthReference}
          className="record-editor__menu-width-reference"
          aria-hidden="true"
        />
        {toolbarButton(
          'undo',
          t('record.editor.undo'),
          t('record.editor.undoShortcut'),
          'undo',
          undefined,
          !state.canUndo,
        )}
        {toolbarButton(
          'redo',
          t('record.editor.redo'),
          t('record.editor.redoShortcut'),
          'redo',
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
          onPointerDown={keepEditorSelection}
          onClick={(event) =>
            blockMenuOpen
              ? closeBlockMenu(false)
              : openBlockMenu(event.detail === 0)
          }
        >
          <EditorIcon name={currentBlockIcon} />
          <span className="record-editor__block-style-label">
            {currentBlockLabel}
          </span>
          <RecordControlIcon name="expand" />
        </button>
        <RecordOverlay
          id={blockMenuId}
          open={blockMenuOpen}
          kind="menu"
          labelledBy={blockButtonId}
          anchorRef={blockButton}
          widthRef={menuWidthReference}
          onClose={closeBlockMenu}
          className="record-menu record-editor__block-menu"
        >
          <div
            className="record-menu__items record-editor__menu-items"
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
                event.preventDefault()
                moveBlockFocus(1)
              } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
                event.preventDefault()
                moveBlockFocus(-1)
              } else if (event.key === 'Home' || event.key === 'End') {
                event.preventDefault()
                blockOptions.current[
                  event.key === 'Home' ? 0 : blockStyles.length - 1
                ]?.focus()
              }
            }}
          >
            {blockStyles.map((option, index) => (
              <Fragment key={option.value}>
                <button
                  ref={(element) => {
                    blockOptions.current[index] = element
                  }}
                  type="button"
                  className="record-menu__item"
                  role="menuitemradio"
                  aria-checked={state.block === option.value}
                  onClick={() => {
                    setBlockMenuOpen(false)
                    run(option.value)
                  }}
                >
                  <EditorIcon name={option.icon} />
                  <span>{option.label}</span>
                  <span className="record-editor__menu-check" aria-hidden>
                    {state.block === option.value ? (
                      <RecordControlIcon name="check" />
                    ) : null}
                  </span>
                </button>
                {option.value === 'subheading' ? (
                  <span
                    className="record-track-menu__separator"
                    role="separator"
                  />
                ) : null}
              </Fragment>
            ))}
          </div>
        </RecordOverlay>
        {toolbarButton(
          'bold',
          t('record.editor.bold'),
          t('record.editor.boldShortcut'),
          'bold',
          state.bold,
        )}
        {toolbarButton(
          'italic',
          t('record.editor.italic'),
          t('record.editor.italicShortcut'),
          'italic',
          state.italic,
        )}
        <ToolbarOverflowMenu
          className="record-editor__inline-overflow"
          label={t('record.editor.moreFormatting')}
          icon="more-formatting"
          disabled={disabled}
          widthRef={menuWidthReference}
          triggerRef={inlineMenuButton}
          captureSelection={captureSelection}
          items={inlineMenuItems}
        />
        {toolbarButton(
          'underline',
          t('record.editor.underline'),
          t('record.editor.underlineShortcut'),
          'underline',
          state.underline,
          false,
          'record-editor__inline-direct',
        )}
        {toolbarButton(
          'strikethrough',
          t('record.editor.strikethrough'),
          t('record.editor.strikethrough'),
          'strikethrough',
          state.strikethrough,
          false,
          'record-editor__inline-direct',
        )}
        {toolbarButton(
          'inline-code',
          t('record.editor.inlineCode'),
          t('record.editor.inlineCode'),
          'inlineCode',
          state.inlineCode,
          false,
          'record-editor__inline-direct',
        )}
        <span className="record-editor__toolbar-separator" aria-hidden="true" />
        {toolbarButton(
          'bullet-list',
          t('record.editor.list'),
          t('record.editor.listShortcut'),
          'bulletList',
          state.bulletList,
          false,
          'record-editor__list-direct',
        )}
        {toolbarButton(
          'ordered-list',
          t('record.editor.orderedList'),
          t('record.editor.orderedListShortcut'),
          'numberList',
          state.numberList,
          false,
          'record-editor__list-direct',
        )}
        {toolbarButton(
          'indent',
          t('record.editor.indent'),
          t('record.editor.indent'),
          'indent',
          undefined,
          false,
          'record-editor__list-direct',
        )}
        {toolbarButton(
          'outdent',
          t('record.editor.outdent'),
          t('record.editor.outdent'),
          'outdent',
          undefined,
          false,
          'record-editor__list-direct',
        )}
        <ToolbarOverflowMenu
          className="record-editor__list-overflow"
          label={t('record.editor.listOptions')}
          icon="bullet-list"
          disabled={disabled}
          widthRef={menuWidthReference}
          captureSelection={captureSelection}
          items={listMenuItems}
        />
        <span className="record-editor__toolbar-separator" aria-hidden="true" />
        {toolbarButton(
          'divider',
          t('record.editor.divider'),
          t('record.editor.divider'),
          'divider',
        )}
        {toolbarButton(
          'clear',
          t('record.editor.clearFormatting'),
          t('record.editor.clearFormatting'),
          'clear',
        )}
        <span
          className="record-editor__toolbar-separator record-editor__inline-direct"
          aria-hidden="true"
        />
        <button
          ref={linkButton}
          type="button"
          className="record-editor__inline-direct"
          aria-label={t('record.editor.link')}
          aria-pressed={state.link}
          aria-haspopup="dialog"
          aria-expanded={linkPanelOpen}
          aria-controls={linkPanelId}
          title={t('record.editor.linkShortcut')}
          disabled={disabled}
          onPointerDown={keepEditorSelection}
          onClick={() => openLinkPanel(linkButton.current)}
        >
          <EditorIcon name="link" />
        </button>
      </div>
      <RecordOverlay
        id={linkPanelId}
        open={linkPanelOpen}
        kind="anchored"
        labelledBy={linkHeadingId}
        anchorRef={linkAnchor}
        initialFocusRef={linkInput}
        onClose={() => setLinkPanelOpen(false)}
        onClosed={completePendingLinkAction}
        className="record-editor__link-popup"
      >
        <form className="record-editor__link-panel" onSubmit={submitLink}>
          <h2 id={linkHeadingId} className="visually-hidden">
            {state.link === true
              ? t('record.editor.editLinkDialog')
              : t('record.editor.linkDialog')}
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
            {state.link === true ? (
              <button
                type="button"
                className="button"
                onClick={() => {
                  pendingLinkAction.current = {
                    type: 'remove',
                    range: linkSelection.current,
                  }
                  setLinkPanelOpen(false)
                }}
              >
                {t('record.editor.unlink')}
              </button>
            ) : null}
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
}: WritingSurfaceProps) {
  const t = useTranslate()
  const pellHost = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLDivElement | null>(null)
  const onChangeRef = useRef(onChange)
  const installedValue = useRef(value)
  const lastEmitted = useRef<string | null>(null)
  const composing = useRef(false)
  const placedInitialCaret = useRef(false)
  const lastEditorRange = useRef<Range | null>(null)
  const history = useRef([value])
  const historyIndex = useRef(0)
  const runCommandRef = useRef<(command: EditorCommand) => void>(
    () => undefined,
  )
  const [toolbar, setToolbar] = useState(EMPTY_TOOLBAR_STATE)
  const [empty, setEmpty] = useState(value.length === 0)
  const [linkShortcut, setLinkShortcut] = useState(0)

  useLayoutEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  const refresh = useCallback(() => {
    const root = content.current
    if (!root) return
    setToolbar(
      readToolbarState(
        root,
        historyIndex.current > 0,
        historyIndex.current < history.current.length - 1,
      ),
    )
  }, [])

  const install = useCallback(
    (markdown: string, offsets: ReturnType<typeof selectionOffsets> = null) => {
      const root = content.current
      if (!root) return
      root.replaceChildren(
        renderEditorFragment(decodeMarkdown(markdown), root.ownerDocument),
      )
      installedValue.current = markdown
      setEmpty(markdown.length === 0)
      if (offsets) restoreOffsets(root, offsets)
      refresh()
    },
    [refresh],
  )

  const emit = useCallback(
    (recordHistory = true) => {
      const root = content.current
      if (!root || composing.current) return
      root.normalize()
      applyPresentationClasses(root)
      const markdown = encodeMarkdown(decodeEditorDom(root))
      setEmpty(markdown.length === 0)
      if (markdown === lastEmitted.current) {
        refresh()
        return
      }
      lastEmitted.current = markdown
      installedValue.current = markdown
      if (recordHistory && history.current[historyIndex.current] !== markdown) {
        history.current = history.current.slice(0, historyIndex.current + 1)
        history.current.push(markdown)
        historyIndex.current += 1
      }
      onChangeRef.current(markdown)
      refresh()
    },
    [refresh],
  )

  useLayoutEffect(() => {
    const host = pellHost.current
    if (!host) return
    const ownerDocument = host.ownerDocument as Document & {
      execCommand?: (
        command: string,
        showUi?: boolean,
        value?: string | null,
      ) => boolean
    }
    if (typeof ownerDocument.execCommand !== 'function') {
      ownerDocument.execCommand = () => false
    }
    const pell = initPell({
      element: host,
      actions: [],
      defaultParagraphSeparator: 'p',
      styleWithCSS: false,
      classes: {
        actionbar: 'record-editor__pell-actions',
        content: 'record-editor__content',
      },
      onChange: () => undefined,
    })
    pell.querySelector('.record-editor__pell-actions')?.remove()
    const root = pell.content
    content.current = root
    root.setAttribute('role', 'textbox')
    root.setAttribute('aria-label', t('record.editor.source'))
    root.setAttribute('aria-multiline', 'true')
    root.setAttribute('aria-placeholder', t('record.editor.placeholder'))
    root.spellcheck = true
    root.setAttribute('contenteditable', disabled ? 'false' : 'true')
    pellExec('styleWithCSS', false)
    root.replaceChildren(
      renderEditorFragment(decodeMarkdown(value), ownerDocument),
    )
    history.current = [value]
    historyIndex.current = 0
    installedValue.current = value
    setEmpty(value.length === 0)

    const onInput = () => {
      if (!composing.current) emit()
    }
    const onCompositionStart = () => {
      composing.current = true
    }
    const onCompositionEnd = () => {
      composing.current = false
      emit()
    }
    const onSelectionChange = () => {
      const range = activeRange(root)
      if (
        range &&
        (!range.collapsed || root.contains(ownerDocument.activeElement))
      ) {
        lastEditorRange.current = range.cloneRange()
        refresh()
      }
    }
    const onFocus = () => {
      if (placedInitialCaret.current) return
      placedInitialCaret.current = true
      placeCaretAtEnd(root)
      lastEditorRange.current = activeRange(root)?.cloneRange() ?? null
      refresh()
    }
    const onClick = () => {
      const range = activeRange(root)
      if (
        range?.collapsed &&
        range.startContainer === root &&
        root.childNodes.length > 0
      ) {
        placeCaretAtEnd(root)
      }
      lastEditorRange.current = activeRange(root)?.cloneRange() ?? null
      refresh()
    }
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (
        event.isComposing ||
        !(event.ctrlKey || event.metaKey) ||
        event.altKey
      ) {
        return
      }
      const key = event.key.toLowerCase()
      if (key === 'b' && !event.shiftKey) {
        event.preventDefault()
        runCommandRef.current('bold')
      } else if (key === 'i' && !event.shiftKey) {
        event.preventDefault()
        runCommandRef.current('italic')
      } else if (key === 'u' && !event.shiftKey) {
        event.preventDefault()
        runCommandRef.current('underline')
      } else if (key === 'k' && !event.shiftKey) {
        event.preventDefault()
        setLinkShortcut((current) => current + 1)
      } else if (event.shiftKey && key === '7') {
        event.preventDefault()
        runCommandRef.current('numberList')
      } else if (event.shiftKey && key === '8') {
        event.preventDefault()
        runCommandRef.current('bulletList')
      }
    }
    const onPaste = (event: ClipboardEvent) => {
      if (!event.clipboardData) return
      event.preventDefault()
      const html = event.clipboardData.getData('text/html')
      const text = event.clipboardData.getData('text/plain')
      const parsed = html
        ? new DOMParser().parseFromString(html, 'text/html')
        : null
      if (parsed && parsed.body.childElementCount > 0) {
        const safe = renderEditorFragment(
          decodeEditorDom(parsed.body),
          ownerDocument,
        )
        const temporary = ownerDocument.createElement('div')
        temporary.append(safe)
        const observer = new MutationObserver(() => undefined)
        observer.observe(root, { childList: true, subtree: true })
        const inserted = pellExec('insertHTML', temporary.innerHTML)
        const changed = observer.takeRecords().length > 0
        observer.disconnect()
        if (!inserted || !changed) {
          insertFragment(
            root,
            renderEditorFragment(decodeEditorDom(temporary), ownerDocument),
          )
        }
      } else if (!pellExec('insertText', text)) {
        const fragment = ownerDocument.createDocumentFragment()
        text.split('\n').forEach((line, index) => {
          if (index > 0) fragment.append(ownerDocument.createElement('br'))
          fragment.append(ownerDocument.createTextNode(line))
        })
        insertFragment(root, fragment)
      }
      queueMicrotask(() => emit())
    }

    root.addEventListener('input', onInput)
    root.addEventListener('compositionstart', onCompositionStart)
    root.addEventListener('compositionend', onCompositionEnd)
    root.addEventListener('keydown', onKeyDown)
    root.addEventListener('paste', onPaste)
    root.addEventListener('focus', onFocus)
    root.addEventListener('click', onClick)
    ownerDocument.addEventListener('selectionchange', onSelectionChange)
    refresh()
    return () => {
      root.removeEventListener('input', onInput)
      root.removeEventListener('compositionstart', onCompositionStart)
      root.removeEventListener('compositionend', onCompositionEnd)
      root.removeEventListener('keydown', onKeyDown)
      root.removeEventListener('paste', onPaste)
      root.removeEventListener('focus', onFocus)
      root.removeEventListener('click', onClick)
      ownerDocument.removeEventListener('selectionchange', onSelectionChange)
      content.current = null
      host.replaceChildren()
    }
    // The exact destination keys the surface; installation happens once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const root = content.current
    if (!root) return
    root.setAttribute('contenteditable', disabled ? 'false' : 'true')
    if (!disabled && !placedInitialCaret.current) {
      queueMicrotask(() => {
        if (!root.isConnected || placedInitialCaret.current) return
        root.focus({ preventScroll: true })
        placeCaretAtEnd(root)
        placedInitialCaret.current = true
        lastEditorRange.current = activeRange(root)?.cloneRange() ?? null
        refresh()
      })
    }
  }, [disabled, refresh])

  useEffect(() => {
    const root = content.current
    if (
      !root ||
      value === installedValue.current ||
      value === lastEmitted.current
    ) {
      installedValue.current = value
      return
    }
    const focused = root.contains(root.ownerDocument.activeElement)
    install(value, focused ? selectionOffsets(root) : null)
    history.current = [value]
    historyIndex.current = 0
  }, [install, value])

  const restoreRange = useCallback((range: Range | null) => {
    const root = content.current
    if (!root || !range || !range.startContainer.isConnected) return
    const selection = root.ownerDocument.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range.cloneRange())
  }, [])

  const nativeCommand = useCallback((command: string, value?: string) => {
    try {
      return pellExec(command, value ?? null)
    } catch {
      return false
    }
  }, [])

  const runCommand = useCallback(
    (command: EditorCommand) => {
      const root = content.current
      if (!root || disabled) return
      const focused = root.contains(root.ownerDocument.activeElement)
      const preserved =
        (focused ? activeRange(root)?.cloneRange() : null) ??
        lastEditorRange.current?.cloneRange() ??
        activeRange(root)?.cloneRange()
      root.focus({ preventScroll: true })
      if (preserved) restoreRange(preserved)
      const currentState = readToolbarState(root, false, false)
      let changed = false
      switch (command) {
        case 'undo':
        case 'redo': {
          changed = nativeCommand(command)
          if (!changed) {
            const direction = command === 'undo' ? -1 : 1
            const next = historyIndex.current + direction
            if (next >= 0 && next < history.current.length) {
              historyIndex.current = next
              const markdown = history.current[next]!
              install(markdown)
              lastEmitted.current = markdown
              onChangeRef.current(markdown)
              changed = true
            }
          }
          break
        }
        case 'bold':
        case 'italic':
        case 'underline':
        case 'strikethrough': {
          const browserCommand =
            command === 'strikethrough' ? 'strikeThrough' : command
          const tag =
            command === 'bold'
              ? 'strong'
              : command === 'italic'
                ? 'em'
                : command === 'underline'
                  ? 'u'
                  : 'del'
          const selector =
            command === 'bold'
              ? 'strong,b'
              : command === 'italic'
                ? 'em,i'
                : command === 'underline'
                  ? 'u'
                  : 'del,s,strike'
          const className =
            command === 'bold'
              ? 'record-editor__bold'
              : command === 'italic'
                ? 'record-editor__italic'
                : command === 'underline'
                  ? 'record-editor__underline'
                  : 'record-editor__strikethrough'
          if (currentState[command] === true) {
            if (command === 'strikethrough') {
              renameElements(root, 'del', 's')
            }
            changed = nativeCommand(browserCommand)
            if (changed) repairNativeFormatRemoval(root, selector)
            if (command === 'strikethrough') {
              renameElements(root, 's,strike', 'del')
            }
            if (readToolbarState(root, false, false)[command] === true) {
              changed =
                unwrapSelectionWithNativeHtml(root, selector, nativeCommand) ||
                unwrapClosest(root, selector) ||
                changed
            }
          } else {
            changed =
              wrapSelectionWithNativeHtml(
                root,
                tag,
                className,
                nativeCommand,
              ) || wrapSelection(root, tag)
          }
          break
        }
        case 'inlineCode':
          changed =
            currentState.inlineCode === true
              ? unwrapSelectionWithNativeHtml(root, 'code', nativeCommand) ||
                unwrapClosest(root, 'code')
              : wrapSelectionWithNativeHtml(
                  root,
                  'code',
                  'record-editor__code',
                  nativeCommand,
                ) || wrapSelection(root, 'code')
          break
        case 'bulletList':
          changed = nativeCommand('insertUnorderedList')
          if (!changed) changed = toggleList(root, 'ul')
          break
        case 'numberList':
          changed = nativeCommand('insertOrderedList')
          if (!changed) changed = toggleList(root, 'ol')
          break
        case 'indent':
        case 'outdent':
          if (
            closestWithin(root, activeRange(root)?.startContainer ?? null, 'li')
          ) {
            changed = nativeCommand(command)
            if (!changed) changed = adjustListDepth(root, command === 'indent')
          }
          break
        case 'paragraph':
        case 'heading':
        case 'subheading':
        case 'quote':
        case 'codeBlock': {
          const tag =
            command === 'paragraph'
              ? 'p'
              : command === 'heading'
                ? 'h1'
                : command === 'subheading'
                  ? 'h2'
                  : command === 'quote'
                    ? 'blockquote'
                    : 'pre'
          changed =
            command !== 'codeBlock' && nativeCommand('formatBlock', `<${tag}>`)
          if (!changed) changed = replaceSelectedBlocks(root, tag)
          break
        }
        case 'divider':
          changed = nativeCommand('insertHorizontalRule')
          if (!changed) changed = insertDivider(root)
          break
        case 'clear':
          changed = nativeCommand('removeFormat')
          changed = clearSelectionWithNativeHtml(root, nativeCommand) || changed
          changed = nativeCommand('unlink') || changed
          changed = nativeCommand('formatBlock', '<p>') || changed
          changed = replaceSelectedBlocks(root, 'p') || changed
          break
      }
      lastEditorRange.current = activeRange(root)?.cloneRange() ?? null
      if (changed) queueMicrotask(() => emit())
      else refresh()
    },
    [disabled, emit, install, nativeCommand, refresh, restoreRange],
  )

  useLayoutEffect(() => {
    runCommandRef.current = runCommand
  }, [runCommand])

  const captureSelection = useCallback(() => {
    const root = content.current
    if (!root) return null
    const focused = root.contains(root.ownerDocument.activeElement)
    const range =
      (focused ? activeRange(root)?.cloneRange() : null) ??
      lastEditorRange.current?.cloneRange() ??
      activeRange(root)?.cloneRange() ??
      null
    if (range) lastEditorRange.current = range.cloneRange()
    return range
  }, [])

  const applyLink = useCallback(
    (url: string, range: Range | null) => {
      const root = content.current
      if (!root) return
      const selection =
        range?.startContainer.isConnected &&
        root.contains(range.commonAncestorContainer)
          ? range.cloneRange()
          : activeRange(root)?.cloneRange()
      if (!selection) return
      const existing = closestWithin(root, selection.startContainer, 'a[href]')
      if (existing instanceof HTMLAnchorElement) {
        existing.setAttribute('href', url)
        existing.rel = 'noreferrer'
        selectContents(existing)
      } else if (selection.collapsed) {
        const anchor = root.ownerDocument.createElement('a')
        anchor.href = url
        anchor.rel = 'noreferrer'
        anchor.textContent = t('record.editor.linkPlaceholder')
        selection.insertNode(anchor)
        selectContents(anchor)
      } else {
        wrapLinkRange(root, selection, url)
      }
      for (const anchor of root.querySelectorAll<HTMLAnchorElement>(
        'a[href]',
      )) {
        anchor.rel = 'noreferrer'
      }
      queueMicrotask(() => emit())
    },
    [emit, t],
  )

  const removeLink = useCallback(
    (range: Range | null) => {
      const root = content.current
      if (!root) return
      const selection =
        range?.startContainer.isConnected &&
        root.contains(range.commonAncestorContainer)
          ? range
          : activeRange(root)
      unwrapElement(closestWithin(root, selection?.startContainer ?? null, 'a'))
      queueMicrotask(() => emit())
    },
    [emit],
  )

  return (
    <div className="record-editor__surface">
      <Toolbar
        disabled={disabled}
        state={toolbar}
        linkShortcut={linkShortcut}
        run={runCommand}
        captureSelection={captureSelection}
        applyLink={applyLink}
        removeLink={removeLink}
      />
      <div className="record-editor__writing">
        <div className="record-editor__pell-host" ref={pellHost} />
        {empty ? (
          <div className="record-editor__placeholder" aria-hidden="true">
            {t('record.editor.placeholder')}
          </div>
        ) : null}
      </div>
    </div>
  )
}
