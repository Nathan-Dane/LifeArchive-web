export interface WritingSurfaceProps {
  readonly value: string
  readonly disabled: boolean
  readonly onChange: (markdown: string) => void
}
