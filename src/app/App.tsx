import { BrowserRouter } from 'react-router-dom'
import type { AppBootstrap } from '../core/bootstrap'
import { I18nProvider } from '../i18n'
import { AppShell } from './AppShell'
import { AppStateProvider } from './providers'

export function App({ bootstrap }: { readonly bootstrap?: AppBootstrap }) {
  return (
    <I18nProvider>
      <BrowserRouter>
        <AppStateProvider bootstrap={bootstrap}>
          <AppShell />
        </AppStateProvider>
      </BrowserRouter>
    </I18nProvider>
  )
}
