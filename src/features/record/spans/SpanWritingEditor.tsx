import { lazy, Suspense } from 'react'
import { failureMessage, useLocalisation, useTranslate } from '../../../i18n'
import type { SpanEditor } from './useSpanEditor'

const MarkdownWritingSurface = lazy(async () => {
  const module = await import('../editor/MarkdownWritingSurface')
  return { default: module.MarkdownWritingSurface }
})

export function SpanWritingEditor({ span }: { readonly span: SpanEditor }) {
  const t = useTranslate()
  const localisation = useLocalisation()
  const draft = span.draft
  const disabled =
    !draft || span.status === 'loading' || span.status === 'missing'
  const status =
    span.status === 'failed' && span.failure
      ? t('record.span.saveFailed', {
          detail: failureMessage(localisation, span.failure),
        })
      : t(`record.span.status.${span.status}`)

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
          {span.status === 'failed' && !span.creating ? (
            <button
              type="button"
              className="button"
              onClick={span.object ? span.retrySave : span.retryLoad}
            >
              {t(
                span.object ? 'record.editor.retrySave' : 'record.editor.retry',
              )}
            </button>
          ) : null}
        </div>
      </header>
      {span.status === 'conflicted' && span.conflict ? (
        <div className="record-editor__conflict" role="alert">
          <h3>{t('record.span.conflictTitle')}</h3>
          <p>{t('record.span.conflictDetail')}</p>
          {span.creating ? null : (
            <div className="record-editor__conflict-actions">
              <button type="button" className="button" onClick={span.saveMine}>
                {t('record.span.conflictSaveMine')}
              </button>
              <button
                type="button"
                className="button button--secondary"
                onClick={span.useArchiveVersion}
              >
                {t('record.span.conflictUseArchive')}
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
          key={span.object?.summary.id ?? 'new-span'}
          value={draft?.markdown ?? ''}
          disabled={disabled}
          onChange={(markdown) => span.update({ markdown })}
        />
      </Suspense>
    </section>
  )
}
