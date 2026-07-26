import { BrowserRouter } from 'react-router-dom'
import type { AppBootstrap } from '../core/bootstrap'
import { AppShell } from './AppShell'
import { AppStateProvider } from './providers'

export function App({ bootstrap }: { readonly bootstrap?: AppBootstrap }) {
  return (
    <BrowserRouter>
      <AppStateProvider bootstrap={bootstrap}>
        <AppShell />
      </AppStateProvider>
    </BrowserRouter>
  )
}
