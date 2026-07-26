import { Component, type ContextType, type ReactNode } from 'react'
import { defaultLocalisation, LocalisationContext } from '../i18n'

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
  /**
   * A class component cannot call a hook, and this one has to keep working
   * when it is the component that caught the error — including an error thrown
   * by a missing message. The context falls back to the complete English
   * catalog, so the boundary always has words to show.
   */
  static contextType = LocalisationContext
  declare context: ContextType<typeof LocalisationContext>

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
    const { t } = this.context ?? defaultLocalisation()
    return (
      <section aria-labelledby="route-error-title" role="alert">
        <h1 id="route-error-title">{t('app.routeError.title')}</h1>
        <p>{t('app.routeError.detail')}</p>
        <button type="button" onClick={this.reset}>
          {t('app.routeError.retry')}
        </button>
        <button type="button" onClick={this.reload}>
          {t('app.action.reload')}
        </button>
      </section>
    )
  }
}
