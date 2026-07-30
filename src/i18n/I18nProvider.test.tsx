import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RouteErrorBoundary } from '../app/RouteErrorBoundary'
import { civilDate } from '../core/client'
import { renderAppAt } from '../test/render'
import { I18nProvider } from './I18nProvider'
import {
  defaultLocalisation,
  resetDefaultLocalisation,
  useFormat,
  useLocalisation,
  useTranslate,
} from './context'
import { MissingMessageError } from './localisation'
import { enMessages } from './messages/en'

const A_DATE = civilDate('2024-03-09')

function Sample() {
  const t = useTranslate()
  const format = useFormat()
  return (
    <p>
      <span data-testid="copy">{t('app.status.booting.title')}</span>
      <span data-testid="date">{format.civilDate(A_DATE)}</span>
      <span data-testid="number">{format.number(1234.5)}</span>
    </p>
  )
}

function Broken() {
  const { t } = useLocalisation()
  const lookup = t as (key: string) => string
  return <p>{lookup('app.status.absent')}</p>
}

afterEach(() => resetDefaultLocalisation())

describe('the localisation provider', () => {
  it('serves catalog copy to components', () => {
    render(
      <I18nProvider>
        <Sample />
      </I18nProvider>,
    )
    expect(screen.getByTestId('copy')).toHaveTextContent(
      enMessages['app.status.booting.title'],
    )
  })

  it('formats dates and numbers for the locale while the copy stays English', () => {
    const { rerender } = render(
      <I18nProvider locale="en-GB">
        <Sample />
      </I18nProvider>,
    )
    expect(screen.getByTestId('date')).toHaveTextContent('9 March 2024')
    expect(screen.getByTestId('number')).toHaveTextContent('1,234.5')

    rerender(
      <I18nProvider locale="da-DK">
        <Sample />
      </I18nProvider>,
    )
    expect(screen.getByTestId('date')).toHaveTextContent('9. marts 2024')
    expect(screen.getByTestId('number')).toHaveTextContent('1.234,5')
    expect(screen.getByTestId('copy')).toHaveTextContent(
      enMessages['app.status.booting.title'],
    )
  })

  it('works without a provider, using the complete English catalog', () => {
    render(<Sample />)
    expect(screen.getByTestId('copy')).toHaveTextContent(
      enMessages['app.status.booting.title'],
    )
    expect(defaultLocalisation().locale).toBe(navigator.language)
  })

  it('surfaces a missing key as a failure the error boundary can hold', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(() => render(<Broken />)).toThrow(MissingMessageError)

    render(
      <RouteErrorBoundary reload={() => undefined}>
        <Broken />
      </RouteErrorBoundary>,
    )
    expect(screen.getByRole('alert')).toHaveTextContent(
      enMessages['app.routeError.detail'],
    )
    vi.restoreAllMocks()
  })
})

describe('the shell after migration', () => {
  it('takes its visible copy from the catalog', async () => {
    renderAppAt('/record')
    expect(
      await screen.findByRole('heading', {
        name: enMessages['record.page.title'],
      }),
    ).toBeInTheDocument()
    /*
     * A view may keep quiet regions of its own, so the notice is found among
     * the status regions rather than assumed to be the only one.
     */
    expect(
      screen.getAllByRole('status').map((region) => region.textContent),
    ).toContain(enMessages['development.mock.notice'])
  })

  it('takes its accessibility copy from the catalog', async () => {
    renderAppAt('/record')
    expect(
      await screen.findByRole('navigation', {
        name: enMessages['app.navigation.main'],
      }),
    ).toBeInTheDocument()
    for (const key of [
      'app.navigation.record',
      'app.navigation.timeline',
      'app.navigation.settings',
    ] as const) {
      expect(
        screen.getByRole('link', { name: enMessages[key] }),
      ).toBeInTheDocument()
    }
  })

  it('renders status screens from the catalog too', async () => {
    renderAppAt('/record', async () => ({
      state: 'runtime',
      runtime: { state: 'unavailable', reason: 'not-integrated' },
    }))
    expect(
      await screen.findByRole('heading', {
        name: enMessages['app.status.runtimeUnavailable.title'],
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: enMessages['app.action.retry'] }),
    ).toBeInTheDocument()
  })
})
