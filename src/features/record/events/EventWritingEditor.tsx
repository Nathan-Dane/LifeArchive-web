import { lazy, Suspense } from 'react'
import { failureMessage, useLocalisation, useTranslate } from '../../../i18n'
import type { EventEditor } from './useEventEditor'

const MarkdownWritingSurface = lazy(async () => {
  const module = await import('../editor/MarkdownWritingSurface')
  return { default: module.MarkdownWritingSurface }
})

export function EventWritingEditor({ event }: { readonly event: EventEditor }) {
  const t = useTranslate()
  const localisation = useLocalisation()
  const draft = event.draft
  const disabled =
    !draft || event.status === 'loading' || event.status === 'missing'
  const status =
    event.status === 'failed' && event.failure
      ? t('record.event.saveFailed', {
          detail: failureMessage(localisation, event.failure),
        })
      : t(`record.event.status.${event.status}`)

  return (
    <section className="record-editor" aria-label={t('record.editor.label')}>
      <header className="record-editor__header">
        <h2 className="title">{t('record.editor.heading')}</h2>
        <div
          className="record-editor__status meta-text"
          role="status"
          aria-live="polite"
        >
          {status}
          {event.status === 'failed' && !event.creating ? (
            <button
              type="button"
              className="button"
              onClick={event.object ? event.retrySave : event.retryLoad}
            >
              {t(
                event.object
                  ? 'record.editor.retrySave'
                  : 'record.editor.retry',
              )}
            </button>
          ) : null}
        </div>
      </header>
      {event.status === 'conflicted' && event.conflict ? (
        <div className="record-editor__conflict" role="alert">
          <h3>{t('record.event.conflictTitle')}</h3>
          <p>{t('record.event.conflictDetail')}</p>
          {event.creating ? null : (
            <div className="record-editor__conflict-actions">
              <button type="button" className="button" onClick={event.saveMine}>
                {t('record.event.conflictSaveMine')}
              </button>
              <button
                type="button"
                className="button button--secondary"
                onClick={event.useArchiveVersion}
              >
                {t('record.event.conflictUseArchive')}
              </button>
            </div>
          )}
        </div>
      ) : null}
      <Suspense
        fallback={
          <div
            className="record-editor__surface"
            aria-label={t('record.editor.source')}
            aria-busy="true"
          />
        }
      >
        <MarkdownWritingSurface
          key={event.object?.summary.id ?? 'new-event'}
          value={draft?.markdown ?? ''}
          disabled={disabled}
          onChange={(markdown) => event.update({ markdown })}
        />
      </Suspense>
    </section>
  )
}
