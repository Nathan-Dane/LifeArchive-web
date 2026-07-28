import { lazy, Suspense } from 'react'
import type {
  LifeArchiveClient,
  StructuredSummary,
  TimeWindow,
} from '../../../core/client'
import { failureMessage, useLocalisation, useTranslate } from '../../../i18n'
import { RecordMedia } from '../media'
import { useEditorDocument } from './useEditorDocument'

const MarkdownWritingSurface = lazy(async () => {
  const module = await import('./MarkdownWritingSurface')
  return { default: module.MarkdownWritingSurface }
})

export interface MarkdownEditorProps {
  readonly client: LifeArchiveClient
  readonly window: TimeWindow | null
  readonly selected: StructuredSummary | null
  readonly developmentMock?: boolean
  readonly allowMedia?: boolean
}

export function MarkdownEditor({
  client,
  window,
  selected,
  developmentMock = false,
  allowMedia = window?.scale === 'day',
}: MarkdownEditorProps) {
  const t = useTranslate()
  const localisation = useLocalisation()
  const {
    document,
    update,
    retryLoad,
    retrySave,
    saveMine,
    useArchiveVersion,
    saveStatus,
    saveFailure,
    conflict,
    mediaOwner,
    adoptMediaRevision,
  } = useEditorDocument(client, window, selected, developmentMock)
  const disabled =
    document.status === 'unavailable' || document.status === 'loading'
  const loadStatus =
    document.status === 'failed' && document.failure
      ? t('record.editor.loadFailed', {
          detail: failureMessage(localisation, document.failure),
        })
      : document.status === 'loading'
        ? t('record.editor.loading')
        : null
  const status =
    loadStatus ??
    (saveStatus === 'failed' && saveFailure
      ? t('record.editor.saveFailed', {
          detail: failureMessage(localisation, saveFailure),
        })
      : t(`record.editor.status.${saveStatus}`))

  return (
    <>
      <section className="record-editor" aria-label={t('record.editor.label')}>
        <header className="record-editor__header">
          <h2 className="title">{t('record.editor.heading')}</h2>
          <div
            className="record-editor__status meta-text"
            role="status"
            aria-live="polite"
          >
            {status}
            {document.status === 'failed' ? (
              <button type="button" className="button" onClick={retryLoad}>
                {t('record.editor.retry')}
              </button>
            ) : null}
            {saveStatus === 'failed' || saveStatus === 'offlineRuntime' ? (
              <button type="button" className="button" onClick={retrySave}>
                {t('record.editor.retrySave')}
              </button>
            ) : null}
          </div>
        </header>
        {saveStatus === 'conflicted' && conflict ? (
          <div
            className="record-editor__conflict"
            role="alert"
            aria-labelledby="record-editor-conflict-title"
          >
            <h3 id="record-editor-conflict-title">
              {t('record.editor.conflictTitle')}
            </h3>
            <p>{t('record.editor.conflictDetail')}</p>
            <div>
              <h4>{t('record.editor.conflictCurrent')}</h4>
              <pre>
                {conflict.presence === 'present'
                  ? conflict.entry.markdown
                  : t('record.editor.conflictCurrentEmpty')}
              </pre>
            </div>
            <div className="record-editor__conflict-actions">
              <button type="button" className="button" onClick={saveMine}>
                {t('record.editor.conflictSaveMine')}
              </button>
              <button
                type="button"
                className="button button--secondary"
                onClick={useArchiveVersion}
              >
                {t('record.editor.conflictUseArchive')}
              </button>
            </div>
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
            key={document.key}
            value={document.markdown}
            disabled={disabled}
            onChange={update}
          />
        </Suspense>
      </section>
      {allowMedia ? (
        <RecordMedia
          client={client}
          ownerId={mediaOwner?.id ?? null}
          developmentMock={developmentMock}
          showBeforeOwnerExists
          onParentRevision={adoptMediaRevision}
        />
      ) : null}
    </>
  )
}
