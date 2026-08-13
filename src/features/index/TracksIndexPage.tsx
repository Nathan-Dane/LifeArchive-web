import { useEffect, useId, useRef } from 'react'
import type { LifeArchiveClient } from '../../core/client'
import { useTranslate } from '../../i18n'
import { RecordOverlay } from '../../ui/overlay'
import { TrackDetails } from '../record/tracks/TrackDetails'
import { TrackManager } from '../record/tracks/TrackChooser'
import { useTracks } from '../record/tracks/useTracks'
import { IndexBreadcrumbs } from './IndexBreadcrumbs'

export function TracksIndexPage({
  client,
  developmentMock,
}: {
  readonly client: LifeArchiveClient
  readonly developmentMock: boolean
}) {
  const t = useTranslate()
  const managerHeading = useId()
  const editorHeading = useId()
  const close = useRef<HTMLButtonElement>(null)
  const opener = useRef<HTMLElement>(null)
  const tracks = useTracks(client, {
    developmentMock,
    onMemberCreated: () => undefined,
    refreshObjects: () => undefined,
  })
  const { setIncludeArchived } = tracks

  useEffect(() => setIncludeArchived(true), [setIncludeArchived])

  const rememberOpener = () => {
    if (document.activeElement instanceof HTMLElement) {
      opener.current = document.activeElement
    }
  }
  const closeEditor = () => {
    if (tracks.state.creating) tracks.cancelCreate()
    else tracks.clearSelection()
    globalThis.queueMicrotask(() => opener.current?.focus())
  }

  return (
    <section
      className="archive-index archive-index--narrow"
      aria-labelledby="tracks-index-heading"
    >
      <IndexBreadcrumbs current={t('index.tracks.title')} />
      <header className="archive-index__header">
        <div>
          <p className="eyebrow">{t('index.page.title')}</p>
          <h1 id="tracks-index-heading" className="display-large" tabIndex={-1}>
            {t('index.tracks.title')}
          </h1>
          <p>{t('index.tracks.pageDetail')}</p>
        </div>
      </header>

      {tracks.state.status === 'loading' && tracks.state.tracks.length === 0 ? (
        <p className="archive-index__status" role="status">
          {t('index.tracks.loading')}
        </p>
      ) : tracks.state.status === 'failed' &&
        tracks.state.tracks.length === 0 ? (
        <div className="archive-index__status" role="alert">
          <p>{t('index.tracks.failure')}</p>
          <button type="button" className="button" onClick={tracks.retry}>
            {t('index.tracks.retry')}
          </button>
        </div>
      ) : (
        <div className="archive-index__manager">
          <TrackManager
            headingId={managerHeading}
            closeRef={close}
            tracks={tracks.state.tracks}
            canCreate
            showClose={false}
            onClose={() => undefined}
            onCreate={() => {
              rememberOpener()
              tracks.startCreate()
            }}
            onSelect={(summary) => {
              rememberOpener()
              tracks.select(summary)
            }}
          />
        </div>
      )}

      <RecordOverlay
        open={tracks.active}
        kind="modal"
        labelledBy={editorHeading}
        anchorRef={opener}
        initialFocusRef={close}
        onClose={closeEditor}
        className="record-track-editor"
      >
        <TrackDetails
          key={tracks.state.creating ? 'new-track' : tracks.state.selected?.id}
          tracks={tracks}
          headingId={editorHeading}
          closeRef={close}
          onClose={closeEditor}
          onCreated={() => closeEditor()}
          onManagementRefresh={tracks.refresh}
        />
      </RecordOverlay>
    </section>
  )
}
