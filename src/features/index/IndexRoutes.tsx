import { lazy, Suspense, useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import type { LifeArchiveClient } from '../../core/client'
import { IndexPage } from './IndexPage'
import { TracksIndexPage } from './TracksIndexPage'

const PeoplePage = lazy(async () => {
  const module = await import('../people')
  return { default: module.PeoplePage }
})

export function IndexRoutes({
  client,
  developmentMock,
}: {
  readonly client: LifeArchiveClient
  readonly developmentMock: boolean
}) {
  const { pathname } = useLocation()
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      document.querySelector<HTMLElement>('#main-content h1')?.focus({
        preventScroll: true,
      })
    })
    return () => cancelAnimationFrame(frame)
  }, [pathname])

  return (
    <Suspense fallback={null}>
      <Routes>
        <Route index element={<IndexPage />} />
        <Route path="people/*" element={<PeoplePage client={client} />} />
        <Route
          path="tracks"
          element={
            <TracksIndexPage
              client={client}
              developmentMock={developmentMock}
            />
          }
        />
        <Route path="*" element={<Navigate to="/index" replace />} />
      </Routes>
    </Suspense>
  )
}

export function LegacyPeopleRedirect() {
  const { pathname, search, hash } = useLocation()
  const suffix = pathname.slice('/people'.length)
  return (
    <Navigate
      to={{ pathname: `/index/people${suffix}`, search, hash }}
      replace
    />
  )
}
