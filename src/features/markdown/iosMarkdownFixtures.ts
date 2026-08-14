/**
 * Public interoperability examples for the documented LifeArchive dialect.
 * They are deliberately authored here rather than copied from native source
 * or private archive fixtures.
 */
export const IOS_MARKDOWN_FIXTURES = [
  {
    name: 'inline traits',
    markdown:
      'Plain **bold** *italic* <u>underlined</u> ~~struck~~ and [a **linked** label](https://example.com/path).',
  },
  {
    name: 'inline code with delimiters',
    markdown: 'Use ``a `literal` tick`` and `ordinary code`.',
  },
  {
    name: 'headings and visible source newline',
    markdown: '# Heading\n\n## Subheading\n\nFirst line\nSecond line',
  },
  {
    name: 'nested mixed lists',
    markdown:
      '- First\n    3. Third\n    4. Fourth\n        - Deep bullet\n- Second',
  },
  {
    name: 'line-oriented boundaries',
    markdown: 'Above\n---\n> Quoted\nNot quoted',
  },
  {
    name: 'literal fenced content',
    markdown: '````typescript\nconst fence = ```\n---\n> still code\n````',
  },
  {
    name: 'unicode',
    markdown: 'Café A\u030A 日本語 👨‍👩‍👧‍👦 🏳️‍🌈',
  },
] as const
