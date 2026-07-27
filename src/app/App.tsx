import { BrowserRouter } from 'react-router-dom'
import type { AppBootstrap } from '../core/bootstrap'
import { I18nProvider } from '../i18n'
import { AppShell } from './AppShell'
import { AppStateProvider } from './providers'
import { AppearanceProvider } from './shell'

export function App({ bootstrap }: { readonly bootstrap?: AppBootstrap }) {
  return (
    <I18nProvider>
      <AppearanceProvider>
        <BrowserRouter>
          <AppStateProvider bootstrap={bootstrap}>
            <AppShell />
          </AppStateProvider>
        </BrowserRouter>
      </AppearanceProvider>
    </I18nProvider>
  )
}
