import { describe, expect, it } from 'vitest'
import { IOS_MARKDOWN_FIXTURES } from './iosMarkdownFixtures'
import {
  InlineTrait,
  decodeEditorDom,
  decodeMarkdown,
  encodeMarkdown,
  renderEditorFragment,
  safeLinkUrl,
  type MarkdownDocument,
} from './markdownCodec'

function canonical(markdown: string) {
  return encodeMarkdown(decodeMarkdown(markdown))
}

function semanticRoundTrips(markdown: string) {
  const first = decodeMarkdown(markdown)
  const encoded = encodeMarkdown(first)
  expect(decodeMarkdown(encoded)).toEqual(first)
  expect(canonical(encoded)).toBe(encoded)

  const root = document.createElement('div')
  root.append(renderEditorFragment(first))
  expect(decodeEditorDom(root)).toEqual(first)

  const rebuilt = document.createElement('div')
  rebuilt.append(renderEditorFragment(decodeEditorDom(root)))
  expect(decodeEditorDom(rebuilt)).toEqual(decodeEditorDom(root))
}

describe('the shared LifeArchive Markdown codec', () => {
  it.each(IOS_MARKDOWN_FIXTURES)('round-trips $name', ({ markdown }) => {
    semanticRoundTrips(markdown)
  })

  it('keeps paragraphs, paragraph boundaries, and visible source newlines', () => {
    const decoded = decodeMarkdown('One\nTwo\n\nThree')
    expect(decoded.blocks).toEqual([
      {
        type: 'paragraph',
        content: [{ text: 'One\nTwo', traits: 0, link: null }],
      },
      {
        type: 'paragraph',
        content: [{ text: 'Three', traits: 0, link: null }],
      },
    ])
    semanticRoundTrips('One\nTwo\n\nThree')
  })

  it('supports every inline trait and nested formatted link labels', () => {
    const decoded = decodeMarkdown(
      '**bold** *italic* <u>under</u> ~~strike~~ [`code`](https://example.com) and [**bold *label***](mailto:hello@example.com)',
    )
    const runs =
      decoded.blocks[0]!.type === 'paragraph' ? decoded.blocks[0]!.content : []
    expect(runs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ text: 'bold', traits: InlineTrait.Bold }),
        expect.objectContaining({ text: 'italic', traits: InlineTrait.Italic }),
        expect.objectContaining({
          text: 'under',
          traits: InlineTrait.Underline,
        }),
        expect.objectContaining({
          text: 'strike',
          traits: InlineTrait.Strikethrough,
        }),
        expect.objectContaining({
          text: 'code',
          traits: InlineTrait.Code,
          link: 'https://example.com',
        }),
        expect.objectContaining({
          text: 'label',
          traits: InlineTrait.Bold | InlineTrait.Italic,
          link: 'mailto:hello@example.com',
        }),
      ]),
    )
    semanticRoundTrips(encodeMarkdown(decoded))
  })

  it('chooses inline-code delimiters that preserve whitespace and backticks', () => {
    const document: MarkdownDocument = {
      blocks: [
        {
          type: 'paragraph',
          content: [
            { text: ' `one``two` ', traits: InlineTrait.Code, link: null },
          ],
        },
      ],
    }
    const markdown = encodeMarkdown(document)
    expect(markdown).toContain('```')
    expect(decodeMarkdown(markdown)).toEqual(document)
  })

  it('normalizes H3 through H6 to the supported H2 semantic style', () => {
    expect(canonical('### Three\n\n###### Six')).toBe('## Three\n\n## Six')
  })

  it('preserves list kind, nesting, and a non-default ordered start', () => {
    const source = '7. Seven\n8. Eight\n    - Nested\n        4. Deep'
    const decoded = decodeMarkdown(source)
    expect(decoded.blocks[0]).toMatchObject({
      type: 'list',
      ordered: true,
      start: 7,
    })
    semanticRoundTrips(source)
  })

  it('applies the divider and quote boundary rules outside fences', () => {
    expect(
      decodeMarkdown('Above\n---\nBelow').blocks.map(({ type }) => type),
    ).toEqual(['paragraph', 'divider', 'paragraph'])
    expect(
      decodeMarkdown('> Quoted\nNot quoted').blocks.map(({ type }) => type),
    ).toEqual(['quote', 'paragraph'])
    expect(decodeMarkdown('```text\n---\n> literal\n```').blocks).toEqual([
      {
        type: 'codeBlock',
        code: '---\n> literal\n',
        language: 'text',
      },
    ])
  })

  it('grows a fenced-code delimiter and preserves the language', () => {
    const document: MarkdownDocument = {
      blocks: [
        {
          type: 'codeBlock',
          code: 'before\n```\nafter\n',
          language: 'swift',
        },
      ],
    }
    const markdown = encodeMarkdown(document)
    expect(markdown.startsWith('````swift\n')).toBe(true)
    expect(decodeMarkdown(markdown)).toEqual(document)
  })

  it('preserves escaped punctuation, malformed input, and Unicode', () => {
    semanticRoundTrips(String.raw`Literal \* \[ \< \# \\ Café Å 日本語 👩🏽‍🚀`)
    semanticRoundTrips('Unclosed **bold and [link](https://example.com')
  })

  it('allows only the established link policy and rejects obfuscation', () => {
    expect(safeLinkUrl('https://example.com/a')).toBe('https://example.com/a')
    expect(safeLinkUrl('http://example.com')).toBe('http://example.com')
    expect(safeLinkUrl('mailto:hello@example.com')).toBe(
      'mailto:hello@example.com',
    )
    expect(safeLinkUrl('example.com/path')).toBe('https://example.com/path')
    expect(safeLinkUrl('/relative')).toBe('/relative')
    expect(safeLinkUrl('javascript:alert(1)')).toBeNull()
    expect(safeLinkUrl('java%73cript:alert(1)')).toBeNull()
    expect(safeLinkUrl('data:text/html,hello')).toBeNull()
    expect(safeLinkUrl('vbscript:msgbox(1)')).toBeNull()
    expect(safeLinkUrl('custom:thing')).toBeNull()
    expect(safeLinkUrl('https://example.com/\u0000x')).toBeNull()
  })

  it('keeps unsafe stored links as ordinary visible labels', () => {
    expect(canonical('[safe label](javascript:alert(1))')).toBe('safe label')
  })

  it('supports only exact underline tokens and keeps arbitrary HTML inert text', () => {
    const source =
      '<u>yes</u> <U>literal</U> <u class="bad">literal</u> <script>alert(1)</script>'
    const encoded = canonical(source)
    expect(encoded).toContain('<u>yes</u>')
    expect(encoded).toContain('\\<U\\>literal\\</U\\>')
    expect(encoded).toContain('\\<script\\>alert(1)\\</script\\>')

    const root = document.createElement('div')
    root.append(renderEditorFragment(decodeMarkdown(source)))
    expect(root.querySelector('script')).toBeNull()
    expect(root.querySelector('u')).toHaveTextContent('yes')
  })

  it('keeps Markdown images unsupported and never creates an image DOM node', () => {
    const document = decodeMarkdown(
      'Before ![alt](https://example.com/x.png) after',
    )
    const root = globalThis.document.createElement('div')
    root.append(renderEditorFragment(document))
    expect(root.querySelector('img')).toBeNull()
    expect(root).toHaveTextContent('![alt](https://example.com/x.png)')
    expect(canonical(encodeMarkdown(document))).toBe(encodeMarkdown(document))
  })

  it('decodes only allowlisted editor DOM semantics', () => {
    const root = document.createElement('div')
    const paragraph = document.createElement('p')
    const bold = document.createElement('b')
    bold.textContent = 'bold'
    const span = document.createElement('span')
    span.style.color = 'red'
    span.id = 'foreign'
    span.textContent = ' safe text'
    const script = document.createElement('script')
    script.textContent = 'alert(1)'
    const image = document.createElement('img')
    image.setAttribute('onerror', 'alert(1)')
    paragraph.append(bold, span, script, image)
    root.append(paragraph)

    const normalized = document.createElement('div')
    normalized.append(renderEditorFragment(decodeEditorDom(root)))
    expect(normalized.textContent).toBe('bold safe text')
    expect(normalized.querySelector('strong')).toHaveTextContent('bold')
    expect(
      normalized.querySelector('span,script,img,[style],[id],[onerror]'),
    ).toBeNull()
  })

  it('removes hostile pasted structures, handlers, media, and unsafe anchors', () => {
    const parser = new DOMParser()
    const pasted = parser.parseFromString(
      '<p onclick="alert(1)"><strong>kept</strong><a href="javascript:alert(1)"> label</a><img src=x onerror=alert(1)><iframe srcdoc="<script>alert(1)</script>"></iframe><svg onload="alert(1)"></svg></p>',
      'text/html',
    )
    const normalized = document.createElement('div')
    normalized.append(renderEditorFragment(decodeEditorDom(pasted.body)))
    expect(normalized.textContent).toBe('kept label')
    expect(normalized.querySelector('strong')).toHaveTextContent('kept')
    expect(
      normalized.querySelector('a,img,iframe,svg,script,[onclick]'),
    ).toBeNull()
  })
})
