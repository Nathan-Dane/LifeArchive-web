import { lazy, Suspense } from 'react'
import type {
  LifeArchiveClient,
  StructuredSummary,
  TimeWindow,
} from '../../../core/client'
import { failureMessage, useLocalisation, useTranslate } from '../../../i18n'
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
}

export function MarkdownEditor({
  client,
  window,
  selected,
  developmentMock = false,
}: MarkdownEditorProps) {
  const t = useTranslate()
  const localisation = useLocalisation()
  const { document, update, retry, save, saveStatus, saveFailure } =
    useEditorDocument(client, window, selected, developmentMock)
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
            <button type="button" className="button" onClick={retry}>
              {t('record.editor.retry')}
            </button>
          ) : null}
          {!developmentMock &&
          selected === null &&
          document.status === 'ready' ? (
            <button
              type="button"
              className="button"
              disabled={saveStatus === 'saving' || saveStatus === 'conflicted'}
              onClick={() => void save()}
            >
              {t('record.editor.save')}
            </button>
          ) : null}
        </div>
      </header>
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
  )
}
