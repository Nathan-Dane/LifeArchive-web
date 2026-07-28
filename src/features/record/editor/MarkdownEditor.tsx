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
}

export function MarkdownEditor({
  client,
  window,
  selected,
}: MarkdownEditorProps) {
  const t = useTranslate()
  const localisation = useLocalisation()
  const { document, update, retry } = useEditorDocument(
    client,
    window,
    selected,
  )
  const disabled =
    document.status === 'unavailable' || document.status === 'loading'
  const status =
    document.status === 'failed' && document.failure
      ? t('record.editor.loadFailed', {
          detail: failureMessage(localisation, document.failure),
        })
      : document.status === 'loading'
        ? t('record.editor.loading')
        : t('record.editor.mockStatus')

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
