export const InlineTrait = {
  Bold: 1 << 0,
  Italic: 1 << 1,
  Underline: 1 << 2,
  Strikethrough: 1 << 3,
  Code: 1 << 4,
} as const

export interface MarkdownInline {
  readonly text: string
  readonly traits: number
  readonly link: string | null
}

export type MarkdownBlock =
  | { readonly type: 'paragraph'; readonly content: readonly MarkdownInline[] }
  | {
      readonly type: 'heading'
      readonly level: 1 | 2
      readonly content: readonly MarkdownInline[]
    }
  | { readonly type: 'quote'; readonly blocks: readonly MarkdownBlock[] }
  | {
      readonly type: 'list'
      readonly ordered: boolean
      readonly start: number
      readonly items: readonly (readonly MarkdownBlock[])[]
    }
  | {
      readonly type: 'codeBlock'
      readonly code: string
      readonly language: string | null
    }
  | { readonly type: 'divider' }

export interface MarkdownDocument {
  readonly blocks: readonly MarkdownBlock[]
}

interface Fence {
  readonly length: number
  readonly info: string
}

interface ListMarker {
  readonly indent: number
  readonly ordered: boolean
  readonly ordinal: number
  readonly content: string
}

type InlineFrameType =
  'root' | 'bold' | 'italic' | 'underline' | 'strikethrough' | 'link'

interface InlineFrame {
  readonly type: InlineFrameType
  readonly marker: string
  readonly runs: MarkdownInline[]
}

const DANGEROUS_ELEMENTS = new Set([
  'SCRIPT',
  'STYLE',
  'IMG',
  'IFRAME',
  'SVG',
  'OBJECT',
  'EMBED',
  'VIDEO',
  'AUDIO',
  'SOURCE',
  'TRACK',
  'CANVAS',
  'MATH',
  'FORM',
  'INPUT',
  'BUTTON',
  'TEXTAREA',
  'SELECT',
  'OPTION',
])

const INLINE_TAGS = new Set([
  'A',
  'B',
  'BR',
  'CODE',
  'DEL',
  'EM',
  'FONT',
  'I',
  'S',
  'SPAN',
  'STRIKE',
  'STRONG',
  'U',
])

function inline(
  text: string,
  traits = 0,
  link: string | null = null,
): MarkdownInline {
  return { text, traits, link }
}

function appendRun(
  runs: MarkdownInline[],
  text: string,
  traits = 0,
  link: string | null = null,
) {
  if (!text) return
  const previous = runs.at(-1)
  if (previous?.traits === traits && previous.link === link) {
    runs[runs.length - 1] = { ...previous, text: previous.text + text }
  } else {
    runs.push(inline(text, traits, link))
  }
}

function appendRuns(
  target: MarkdownInline[],
  source: readonly MarkdownInline[],
) {
  for (const run of source) {
    appendRun(target, run.text, run.traits, run.link)
  }
}

function fenceAt(line: string): Fence | null {
  const match = line.match(/^ {0,3}(`{3,})([^`]*)$/u)
  return match ? { length: match[1]!.length, info: match[2]!.trim() } : null
}

function closesFence(line: string, length: number) {
  const match = line.match(/^ {0,3}(`{3,})[\t ]*$/u)
  return Boolean(match && match[1]!.length >= length)
}

function quoteContent(line: string): string | null {
  const match = line.match(/^ {0,3}>[\t ]?(.*)$/u)
  return match?.[1] ?? null
}

function listMarker(line: string): ListMarker | null {
  const match = line.match(/^( *)(?:(-)|([0-9]+)[.)])[\t ]+(.*)$/u)
  if (!match) return null
  const ordered = match[3] !== undefined
  return {
    indent: match[1]!.length,
    ordered,
    ordinal: ordered ? Math.max(1, Number.parseInt(match[3]!, 10)) : 1,
    content: match[4]!,
  }
}

function headingAt(line: string) {
  const match = line.match(/^ {0,3}(#{1,6})[\t ]+(.+?)\s*$/u)
  if (!match) return null
  return {
    level: Math.min(match[1]!.length, 2) as 1 | 2,
    content: match[2]!.replace(/[\t ]+#+[\t ]*$/u, ''),
  }
}

function isDivider(line: string) {
  return line.trim() === '---'
}

function isTopLevelBlockStart(line: string) {
  const marker = listMarker(line)
  return Boolean(
    fenceAt(line) ||
    quoteContent(line) !== null ||
    headingAt(line) ||
    isDivider(line) ||
    marker?.indent === 0,
  )
}

function parseList(
  lines: readonly string[],
  initialIndex: number,
  indent: number,
): { readonly block: MarkdownBlock; readonly index: number } {
  const first = listMarker(lines[initialIndex]!)!
  const items: MarkdownBlock[][] = []
  let index = initialIndex

  while (index < lines.length) {
    const marker = listMarker(lines[index]!)
    if (
      !marker ||
      marker.indent !== indent ||
      marker.ordered !== first.ordered
    ) {
      break
    }

    const itemLines = [marker.content]
    index += 1
    while (index < lines.length) {
      const line = lines[index]!
      const next = listMarker(line)
      if (next?.indent === indent) break
      if (line.trim() === '') {
        itemLines.push('')
        index += 1
        continue
      }
      const leading = line.match(/^ */u)![0].length
      if (leading < indent + 2) break
      const remove = Math.min(leading, indent + 4)
      itemLines.push(line.slice(remove))
      index += 1
    }
    while (itemLines.at(-1) === '') itemLines.pop()
    items.push(decodeMarkdown(itemLines.join('\n')).blocks.slice())
  }

  return {
    block: {
      type: 'list',
      ordered: first.ordered,
      start: first.ordinal,
      items,
    },
    index,
  }
}

export function decodeMarkdown(markdown: string): MarkdownDocument {
  const lines = markdown
    .replaceAll('\r\n', '\n')
    .replaceAll('\r', '\n')
    .split('\n')
  const blocks: MarkdownBlock[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]!
    if (line.trim() === '') {
      index += 1
      continue
    }

    const fence = fenceAt(line)
    if (fence) {
      const content: string[] = []
      index += 1
      while (
        index < lines.length &&
        !closesFence(lines[index]!, fence.length)
      ) {
        content.push(lines[index]!)
        index += 1
      }
      if (index < lines.length) index += 1
      blocks.push({
        type: 'codeBlock',
        code: content.length > 0 ? `${content.join('\n')}\n` : '',
        language: fence.info || null,
      })
      continue
    }

    const heading = headingAt(line)
    if (heading) {
      blocks.push({
        type: 'heading',
        level: heading.level,
        content: decodeInline(heading.content),
      })
      index += 1
      continue
    }

    if (isDivider(line)) {
      blocks.push({ type: 'divider' })
      index += 1
      continue
    }

    if (quoteContent(line) !== null) {
      const quoted: string[] = []
      while (index < lines.length) {
        const content = quoteContent(lines[index]!)
        if (content !== null) {
          quoted.push(content)
          index += 1
          continue
        }
        if (
          lines[index]!.trim() === '' &&
          index + 1 < lines.length &&
          quoteContent(lines[index + 1]!) !== null
        ) {
          quoted.push('')
          index += 1
          continue
        }
        break
      }
      blocks.push({
        type: 'quote',
        blocks: decodeMarkdown(quoted.join('\n')).blocks,
      })
      continue
    }

    const marker = listMarker(line)
    if (marker?.indent === 0) {
      const parsed = parseList(lines, index, 0)
      blocks.push(parsed.block)
      index = parsed.index
      continue
    }

    const paragraph: string[] = [line]
    index += 1
    while (
      index < lines.length &&
      lines[index]!.trim() !== '' &&
      !isTopLevelBlockStart(lines[index]!)
    ) {
      paragraph.push(lines[index]!)
      index += 1
    }
    blocks.push({
      type: 'paragraph',
      content: decodeInline(paragraph.join('\n')),
    })
  }

  return { blocks }
}

function frameTrait(type: InlineFrameType) {
  switch (type) {
    case 'bold':
      return InlineTrait.Bold
    case 'italic':
      return InlineTrait.Italic
    case 'underline':
      return InlineTrait.Underline
    case 'strikethrough':
      return InlineTrait.Strikethrough
    default:
      return 0
  }
}

function closeInlineFrame(stack: InlineFrame[], link: string | null = null) {
  const completed = stack.pop()!
  const target = stack.at(-1)!.runs
  const trait = frameTrait(completed.type)
  for (const run of completed.runs) {
    appendRun(target, run.text, run.traits | trait, link ?? run.link)
  }
}

function openInlineFrame(
  stack: InlineFrame[],
  type: InlineFrameType,
  marker: string,
) {
  stack.push({ type, marker, runs: [] })
}

function longestRunAt(source: string, index: number, character: string) {
  let length = 0
  while (source[index + length] === character) length += 1
  return length
}

function unescapedClosing(source: string, delimiter: string, start: number) {
  let index = start
  while (index < source.length) {
    if (source[index] === '\\') {
      index += 2
      continue
    }
    if (source.startsWith(delimiter, index)) return index
    index += 1
  }
  return -1
}

function decodeCodeSpan(raw: string) {
  if (raw.length >= 2 && raw.startsWith(' ') && raw.endsWith(' ')) {
    return raw.slice(1, -1)
  }
  return raw
}

function linkDestination(source: string, start: number) {
  let depth = 0
  let index = start
  while (index < source.length) {
    const character = source[index]!
    if (character === '\\') {
      index += 2
      continue
    }
    if (character === '(') depth += 1
    if (character === ')') {
      if (depth === 0) {
        return { value: source.slice(start, index), end: index + 1 }
      }
      depth -= 1
    }
    index += 1
  }
  return null
}

function unescapeDestination(value: string) {
  return value.replace(/\\([\\()])/gu, '$1')
}

function decodedForSchemeCheck(value: string) {
  let decoded = value
  for (let count = 0; count < 2; count += 1) {
    try {
      const next = decodeURIComponent(decoded)
      if (next === decoded) break
      decoded = next
    } catch {
      return null
    }
  }
  return decoded
}

/** The existing product policy permits HTTP(S), mail, and same-origin links. */
export function safeLinkUrl(input: string): string | null {
  let value = input.trim()
  if (!value || /[\u0000-\u001f\u007f]/u.test(value)) return null
  const decoded = decodedForSchemeCheck(value)
  if (!decoded || /[\u0000-\u001f\u007f]/u.test(decoded)) return null
  const scheme = decoded.match(/^([a-z][a-z0-9+.-]*):/iu)?.[1]?.toLowerCase()
  if (scheme && !['http', 'https', 'mailto'].includes(scheme)) return null
  if (
    !scheme &&
    /^[\p{L}\p{N}](?:[\p{L}\p{N}.-]*\.)[\p{L}]{2,}(?:[/:?#]|$)/u.test(value)
  ) {
    value = `https://${value}`
  }
  try {
    const parsed = new URL(value, 'https://lifearchive.invalid/')
    if (!['http:', 'https:', 'mailto:'].includes(parsed.protocol)) return null
    if (
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      !parsed.hostname
    ) {
      return null
    }
    if (parsed.protocol === 'mailto:' && !parsed.pathname) return null
    return value
  } catch {
    return null
  }
}

function appendLiteralImage(
  source: string,
  index: number,
  runs: MarkdownInline[],
) {
  const closeLabel = unescapedClosing(source, ']', index + 2)
  if (closeLabel < 0 || source[closeLabel + 1] !== '(') return 0
  const destination = linkDestination(source, closeLabel + 2)
  if (!destination) return 0
  const literal = source.slice(index, destination.end)
  appendRun(runs, literal)
  return literal.length
}

export function decodeInline(source: string): readonly MarkdownInline[] {
  const stack: InlineFrame[] = [{ type: 'root', marker: '', runs: [] }]
  let index = 0

  while (index < source.length) {
    const runs = stack.at(-1)!.runs
    const character = source[index]!

    if (character === '\\' && index + 1 < source.length) {
      appendRun(runs, source[index + 1]!)
      index += 2
      continue
    }

    if (source.startsWith('![', index)) {
      const consumed = appendLiteralImage(source, index, runs)
      if (consumed > 0) {
        index += consumed
        continue
      }
    }

    if (character === '`') {
      const length = longestRunAt(source, index, '`')
      const delimiter = '`'.repeat(length)
      const closing = unescapedClosing(source, delimiter, index + length)
      if (closing >= 0) {
        appendRun(
          runs,
          decodeCodeSpan(source.slice(index + length, closing)),
          InlineTrait.Code,
        )
        index = closing + length
        continue
      }
    }

    if (source.startsWith('<u>', index)) {
      openInlineFrame(stack, 'underline', '<u>')
      index += 3
      continue
    }
    if (source.startsWith('</u>', index)) {
      if (stack.at(-1)!.type === 'underline') closeInlineFrame(stack)
      else appendRun(runs, '</u>')
      index += 4
      continue
    }

    if (character === '[') {
      openInlineFrame(stack, 'link', '[')
      index += 1
      continue
    }
    if (source.startsWith('](', index) && stack.at(-1)!.type === 'link') {
      const destination = linkDestination(source, index + 2)
      if (destination) {
        const url = safeLinkUrl(unescapeDestination(destination.value))
        closeInlineFrame(stack, url)
        index = destination.end
        continue
      }
    }

    if (source.startsWith('~~', index)) {
      const previous = source[index - 1]
      const next = source[index + 2]
      const canOpen = next !== undefined && !/\s/u.test(next)
      const canClose = previous !== undefined && !/\s/u.test(previous)
      if (stack.at(-1)!.type === 'strikethrough' && canClose) {
        closeInlineFrame(stack)
        index += 2
        continue
      }
      if (canOpen) {
        openInlineFrame(stack, 'strikethrough', '~~')
        index += 2
        continue
      }
    }

    if (character === '*' || character === '_') {
      let length = longestRunAt(source, index, character)
      const previous = source[index - 1]
      const next = source[index + length]
      const canOpen = next !== undefined && !/\s/u.test(next)
      const canClose = previous !== undefined && !/\s/u.test(previous)
      let consumed = 0
      while (length > 0) {
        const top = stack.at(-1)!.type
        if (top === 'bold' && length >= 2 && canClose) {
          closeInlineFrame(stack)
          length -= 2
          consumed += 2
        } else if (
          top === 'italic' &&
          canClose &&
          (length === 1 || length % 2 === 1)
        ) {
          closeInlineFrame(stack)
          length -= 1
          consumed += 1
        } else if (length >= 2 && canOpen) {
          openInlineFrame(stack, 'bold', character.repeat(2))
          length -= 2
          consumed += 2
        } else if (canOpen) {
          openInlineFrame(stack, 'italic', character)
          length -= 1
          consumed += 1
        } else {
          break
        }
      }
      if (consumed > 0) {
        index += consumed
        continue
      }
    }

    appendRun(runs, character)
    index += 1
  }

  while (stack.length > 1) {
    const dangling = stack.pop()!
    appendRun(stack.at(-1)!.runs, dangling.marker)
    appendRuns(stack.at(-1)!.runs, dangling.runs)
  }
  return stack[0]!.runs
}

function longestBacktickRun(value: string) {
  let current = 0
  let longest = 0
  for (const character of value) {
    current = character === '`' ? current + 1 : 0
    longest = Math.max(longest, current)
  }
  return longest
}

function encodeCodeSpan(value: string) {
  const fence = '`'.repeat(Math.max(1, longestBacktickRun(value) + 1))
  const padded =
    value.startsWith('`') ||
    value.endsWith('`') ||
    (/^\s/u.test(value) && /\s$/u.test(value))
  return `${fence}${padded ? ' ' : ''}${value}${padded ? ' ' : ''}${fence}`
}

function escapeInlineText(value: string) {
  return value.replace(/[\\`*_{}[\]<>#~]/gu, '\\$&')
}

function escapeLinkDestination(value: string) {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll('(', '\\(')
    .replaceAll(')', '\\)')
    .replaceAll(' ', '%20')
}

function encodeStyledRun(run: MarkdownInline) {
  let leading = ''
  let trailing = ''
  let text = run.text
  if (
    !(run.traits & InlineTrait.Code) &&
    !run.link &&
    !(run.traits & InlineTrait.Underline) &&
    run.traits !== 0
  ) {
    if (/^\s+$/u.test(text)) return escapeInlineText(text)
    leading = text.match(/^\s+/u)?.[0] ?? ''
    trailing = text.match(/\s+$/u)?.[0] ?? ''
    if (leading.length + trailing.length <= text.length) {
      text = text.slice(leading.length, text.length - trailing.length)
    }
  }
  if (!text) return escapeInlineText(run.text)

  const openings: string[] = []
  const closings: string[] = []
  if (run.traits & InlineTrait.Underline) {
    openings.push('<u>')
    closings.unshift('</u>')
  }
  if (run.link) {
    openings.push('[')
    closings.unshift(`](${escapeLinkDestination(run.link)})`)
  }
  if (run.traits & InlineTrait.Strikethrough) {
    openings.push('~~')
    closings.unshift('~~')
  }
  if (run.traits & InlineTrait.Bold) {
    openings.push('**')
    closings.unshift('**')
  }
  if (run.traits & InlineTrait.Italic) {
    openings.push('*')
    closings.unshift('*')
  }
  const content =
    run.traits & InlineTrait.Code
      ? encodeCodeSpan(text)
      : escapeInlineText(text)
  return `${escapeInlineText(leading)}${openings.join('')}${content}${closings.join('')}${escapeInlineText(trailing)}`
}

export function encodeInline(runs: readonly MarkdownInline[]) {
  return runs.map(encodeStyledRun).join('')
}

function escapeBlockStarts(value: string) {
  return value
    .split('\n')
    .map((line) =>
      /^(?: {0,3})(?:---\s*$|>|#{1,6}(?:\s|$)|[-+*]\s|[0-9]+[.)]\s)/u.test(line)
        ? line.replace(/^( *)(.)/u, '$1\\$2')
        : line,
    )
    .join('\n')
}

function indent(value: string, spaces = 4) {
  const prefix = ' '.repeat(spaces)
  return value
    .split('\n')
    .map((line) => prefix + line)
    .join('\n')
}

function encodeItemBlocks(blocks: readonly MarkdownBlock[]) {
  return blocks
    .map((block, index) => {
      const previous = blocks[index - 1]
      const separator =
        index === 0
          ? ''
          : block.type === 'list' || previous?.type === 'list'
            ? '\n'
            : '\n\n'
      return separator + encodeBlock(block)
    })
    .join('')
}

function encodeBlock(block: MarkdownBlock): string {
  switch (block.type) {
    case 'paragraph':
      return escapeBlockStarts(encodeInline(block.content))
    case 'heading':
      return `${'#'.repeat(block.level)} ${encodeInline(block.content)}`
    case 'quote':
      return encodeBlocks(block.blocks)
        .split('\n')
        .map((line) => (line ? `> ${line}` : '>'))
        .join('\n')
    case 'list':
      return block.items
        .map((item, itemIndex) => {
          const marker = block.ordered ? `${block.start + itemIndex}. ` : '- '
          const body = encodeItemBlocks(item)
          const [first = '', ...rest] = body.split('\n')
          return `${marker}${first}${rest.length ? `\n${indent(rest.join('\n'))}` : ''}`
        })
        .join('\n')
    case 'codeBlock': {
      const fence = '`'.repeat(Math.max(3, longestBacktickRun(block.code) + 1))
      const language = block.language?.trim() ?? ''
      return `${fence}${language}\n${block.code}${block.code.endsWith('\n') ? '' : '\n'}${fence}`
    }
    case 'divider':
      return '---'
  }
}

export function encodeBlocks(blocks: readonly MarkdownBlock[]) {
  return blocks.map(encodeBlock).join('\n\n')
}

export function encodeMarkdown(document: MarkdownDocument) {
  return encodeBlocks(document.blocks)
}

function renderInline(
  runs: readonly MarkdownInline[],
  ownerDocument: Document,
) {
  const fragment = ownerDocument.createDocumentFragment()
  for (const run of runs) {
    const pieces = run.text.split('\n')
    pieces.forEach((piece, index) => {
      let node: Node = ownerDocument.createTextNode(piece)
      const wrap = (tag: string, className?: string) => {
        const element = ownerDocument.createElement(tag)
        if (className) element.className = className
        element.append(node)
        node = element
      }
      if (run.traits & InlineTrait.Code) wrap('code', 'record-editor__code')
      if (run.traits & InlineTrait.Italic) wrap('em', 'record-editor__italic')
      if (run.traits & InlineTrait.Bold) wrap('strong', 'record-editor__bold')
      if (run.traits & InlineTrait.Strikethrough) {
        wrap('del', 'record-editor__strikethrough')
      }
      if (run.link) {
        const safe = safeLinkUrl(run.link)
        if (safe) {
          const anchor = ownerDocument.createElement('a')
          anchor.className = 'record-editor__link'
          anchor.href = safe
          anchor.rel = 'noreferrer'
          anchor.append(node)
          node = anchor
        }
      }
      if (run.traits & InlineTrait.Underline) {
        wrap('u', 'record-editor__underline')
      }
      fragment.append(node)
      if (index < pieces.length - 1)
        fragment.append(ownerDocument.createElement('br'))
    })
  }
  return fragment
}

function renderBlock(block: MarkdownBlock, ownerDocument: Document): Node {
  switch (block.type) {
    case 'paragraph': {
      const paragraph = ownerDocument.createElement('p')
      paragraph.className = 'record-editor__paragraph'
      paragraph.append(renderInline(block.content, ownerDocument))
      return paragraph
    }
    case 'heading': {
      const heading = ownerDocument.createElement(`h${block.level}`)
      heading.className = `record-editor__heading record-editor__heading--${
        block.level === 1 ? 'two' : 'three'
      }`
      heading.append(renderInline(block.content, ownerDocument))
      return heading
    }
    case 'quote': {
      const quote = ownerDocument.createElement('blockquote')
      quote.className = 'record-editor__quote'
      quote.append(renderBlocks(block.blocks, ownerDocument))
      return quote
    }
    case 'list': {
      const list = ownerDocument.createElement(block.ordered ? 'ol' : 'ul')
      list.className = block.ordered
        ? 'record-editor__ordered-list'
        : 'record-editor__unordered-list'
      if (block.ordered && block.start !== 1) {
        ;(list as HTMLOListElement).start = block.start
      }
      for (const item of block.items) {
        const listItem = ownerDocument.createElement('li')
        listItem.className = 'record-editor__list-item'
        listItem.append(renderBlocks(item, ownerDocument))
        list.append(listItem)
      }
      return list
    }
    case 'codeBlock': {
      const pre = ownerDocument.createElement('pre')
      pre.className = 'record-editor__code-block'
      const code = ownerDocument.createElement('code')
      code.textContent = block.code
      if (block.language) code.dataset.language = block.language
      pre.append(code)
      return pre
    }
    case 'divider': {
      const divider = ownerDocument.createElement('hr')
      divider.className = 'record-editor__divider'
      return divider
    }
  }
}

function renderBlocks(
  blocks: readonly MarkdownBlock[],
  ownerDocument: Document,
) {
  const fragment = ownerDocument.createDocumentFragment()
  for (const block of blocks) fragment.append(renderBlock(block, ownerDocument))
  return fragment
}

export function renderEditorFragment(
  document: MarkdownDocument,
  ownerDocument: Document = globalThis.document,
) {
  return renderBlocks(document.blocks, ownerDocument)
}

interface InlineContext {
  readonly traits: number
  readonly link: string | null
}

function decodeInlineNodes(
  nodes: Iterable<Node>,
  context: InlineContext = { traits: 0, link: null },
) {
  const runs: MarkdownInline[] = []
  for (const node of nodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      appendRun(runs, node.nodeValue ?? '', context.traits, context.link)
      continue
    }
    if (
      !(node instanceof HTMLElement) ||
      DANGEROUS_ELEMENTS.has(node.tagName)
    ) {
      continue
    }
    if (node.tagName === 'BR') {
      appendRun(runs, '\n', context.traits, context.link)
      continue
    }

    let traits = context.traits
    let link = context.link
    if (node.matches('strong,b')) traits |= InlineTrait.Bold
    if (node.matches('em,i')) traits |= InlineTrait.Italic
    if (node.tagName === 'U') traits |= InlineTrait.Underline
    if (node.matches('del,s,strike')) traits |= InlineTrait.Strikethrough
    if (node.tagName === 'CODE' && node.parentElement?.tagName !== 'PRE') {
      traits |= InlineTrait.Code
    }
    if (node.tagName === 'A') {
      link = safeLinkUrl(node.getAttribute('href') ?? '')
    }
    appendRuns(runs, decodeInlineNodes(node.childNodes, { traits, link }))
  }
  return runs
}

function decodeList(
  element: HTMLOListElement | HTMLUListElement,
): MarkdownBlock {
  const items: MarkdownBlock[][] = []
  for (const child of element.children) {
    if (child.tagName !== 'LI') continue
    items.push(decodeBlocksFromNodes(child.childNodes))
  }
  return {
    type: 'list',
    ordered: element.tagName === 'OL',
    start:
      element.tagName === 'OL'
        ? Math.max(1, (element as HTMLOListElement).start || 1)
        : 1,
    items,
  }
}

function decodeBlocksFromNodes(nodes: Iterable<Node>) {
  const blocks: MarkdownBlock[] = []
  let pendingInline: Node[] = []
  const flushInline = () => {
    if (pendingInline.length === 0) return
    const content = decodeInlineNodes(pendingInline)
    if (content.length > 0) blocks.push({ type: 'paragraph', content })
    pendingInline = []
  }

  for (const node of nodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.nodeValue) pendingInline.push(node)
      continue
    }
    if (
      !(node instanceof HTMLElement) ||
      DANGEROUS_ELEMENTS.has(node.tagName)
    ) {
      continue
    }
    if (INLINE_TAGS.has(node.tagName)) {
      pendingInline.push(node)
      continue
    }
    flushInline()
    if (node.matches('p,div')) {
      const nestedBlock = [...node.children].some(
        (child) => !INLINE_TAGS.has(child.tagName),
      )
      if (nestedBlock) blocks.push(...decodeBlocksFromNodes(node.childNodes))
      else
        blocks.push({
          type: 'paragraph',
          content: decodeInlineNodes(node.childNodes),
        })
    } else if (node.matches('h1,h2,h3,h4,h5,h6')) {
      blocks.push({
        type: 'heading',
        level: node.tagName === 'H1' ? 1 : 2,
        content: decodeInlineNodes(node.childNodes),
      })
    } else if (node.matches('ul,ol')) {
      blocks.push(decodeList(node as HTMLOListElement | HTMLUListElement))
    } else if (node.tagName === 'BLOCKQUOTE') {
      blocks.push({
        type: 'quote',
        blocks: decodeBlocksFromNodes(node.childNodes),
      })
    } else if (node.tagName === 'HR') {
      blocks.push({ type: 'divider' })
    } else if (node.tagName === 'PRE') {
      const code = node.querySelector(':scope > code')
      blocks.push({
        type: 'codeBlock',
        code: code?.textContent ?? node.textContent ?? '',
        language:
          (code as HTMLElement | null)?.dataset.language?.trim() || null,
      })
    } else {
      blocks.push(...decodeBlocksFromNodes(node.childNodes))
    }
  }
  flushInline()
  return blocks
}

export function decodeEditorDom(root: HTMLElement): MarkdownDocument {
  return { blocks: decodeBlocksFromNodes(root.childNodes) }
}

export const markdownCodec = {
  decode: decodeMarkdown,
  encode: encodeMarkdown,
  renderEditorFragment,
  decodeEditorDom,
}
