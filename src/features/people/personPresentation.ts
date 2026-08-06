/** Presentation only. It never enters a request or durable profile. */
export function personInitials(displayName: string): string {
  const words = displayName.split(/\s+/u).filter(Boolean)
  if (words.length === 0) return ''
  const first = graphemes(words[0] ?? '')[0] ?? ''
  if (words.length > 1) {
    const last = graphemes(words.at(-1) ?? '')[0] ?? ''
    return `${first}${last}`.toLocaleUpperCase()
  }
  return graphemes(words[0] ?? '')
    .slice(0, 2)
    .join('')
    .toLocaleUpperCase()
}

function graphemes(value: string): readonly string[] {
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  return Array.from(segmenter.segment(value), ({ segment }) => segment)
}
