/** Material Symbols used only by the visual Markdown command surface. */
export const EDITOR_MATERIAL_GLYPHS = {
  undo: 'undo',
  redo: 'redo',
  paragraph: 'format_paragraph',
  heading: 'format_h1',
  subheading: 'format_h2',
  bold: 'format_bold',
  italic: 'format_italic',
  underline: 'format_underlined',
  strikethrough: 'strikethrough_s',
  'inline-code': 'code',
  'bullet-list': 'format_list_bulleted',
  'ordered-list': 'format_list_numbered',
  indent: 'format_indent_increase',
  outdent: 'format_indent_decrease',
  quote: 'format_quote',
  'code-block': 'code_blocks',
  divider: 'horizontal_rule',
  clear: 'format_clear',
  link: 'link_2',
} as const

export type EditorIconName = keyof typeof EDITOR_MATERIAL_GLYPHS
