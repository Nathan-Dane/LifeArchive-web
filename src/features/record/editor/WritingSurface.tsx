import { lazy, type ComponentType } from 'react'

export interface WritingSurfaceProps {
  readonly value: string
  readonly disabled: boolean
  readonly onChange: (markdown: string) => void
}

/**
 * The feature-facing seam for visual Markdown editing.
 *
 * Feature components depend only on this contract. The selected implementation
 * stays lazy and can be replaced here without changing an editor workflow.
 */
export interface WritingSurfaceAdapter {
  readonly Surface: ComponentType<WritingSurfaceProps>
}

const lexicalAdapter: WritingSurfaceAdapter = {
  Surface: lazy(async () => {
    const module = await import('./MarkdownWritingSurface')
    return { default: module.MarkdownWritingSurface }
  }),
}

export const WritingSurface = lexicalAdapter.Surface
