import { useLayoutEffect, useRef } from 'react'
import { decodeMarkdown, renderEditorFragment } from './markdownCodec'

export interface MarkdownBodyProps {
  readonly markdown: string
  readonly className?: string
}

/** Safe, read-only rendering for a complete LifeArchive Markdown body. */
export function MarkdownBody({ markdown, className }: MarkdownBodyProps) {
  const root = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const element = root.current
    if (!element) return
    element.replaceChildren(
      renderEditorFragment(decodeMarkdown(markdown), element.ownerDocument),
    )
  }, [markdown])

  return <div ref={root} className={className} />
}
