import { Component, type ReactNode } from 'react'

interface RouteErrorBoundaryProps {
  readonly children: ReactNode
  readonly reload?: () => void
}

interface RouteErrorBoundaryState {
  readonly failed: boolean
}

export class RouteErrorBoundary extends Component<
  RouteErrorBoundaryProps,
  RouteErrorBoundaryState
> {
  state: RouteErrorBoundaryState = { failed: false }

  static getDerivedStateFromError(): RouteErrorBoundaryState {
    return { failed: true }
  }

  componentDidCatch(): void {
    // The boundary deliberately reports no content, identifiers, or writing.
  }

  private reset = (): void => this.setState({ failed: false })

  private reload = (): void => {
    ;(this.props.reload ?? (() => globalThis.location.reload()))()
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <section aria-labelledby="route-error-title" role="alert">
        <h1 id="route-error-title">This view could not be shown</h1>
        <p>The archive was not erased or replaced.</p>
        <button type="button" onClick={this.reset}>
          Try this view again
        </button>
        <button type="button" onClick={this.reload}>
          Reload application
        </button>
      </section>
    )
  }
}
