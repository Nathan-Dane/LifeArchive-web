export interface SkipLinkProps {
  readonly targetId: string
  readonly children: string
}

/** A first-tab shortcut to the current view's main landmark. */
export function SkipLink({ targetId, children }: SkipLinkProps) {
  return (
    <a className="skip-link" href={`#${targetId}`}>
      {children}
    </a>
  )
}
