import { Suspense } from 'react'
import { failureMessage, useLocalisation, useTranslate } from '../../../i18n'
import type { EventEditor } from '../events/useEventEditor'
import type { SpanEditor } from '../spans/useSpanEditor'
import { WritingSurface } from './WritingSurface'

type StructuredWritingEditorProps =
  | { readonly kind: 'event'; readonly editor: EventEditor }
  | { readonly kind: 'span'; readonly editor: SpanEditor }

export function StructuredWritingEditor({
  kind,
  editor,
}: StructuredWritingEditorProps) {
  const t = useTranslate()
  const localisation = useLocalisation()
  const draft = editor.draft
  const disabled =
    !draft || editor.status === 'loading' || editor.status === 'missing'
  const status =
    editor.status === 'failed' && editor.failure
      ? t(`record.${kind}.saveFailed`, {
          detail: failureMessage(localisation, editor.failure),
        })
      : t(`record.${kind}.status.${editor.status}`)

  return (
    <section className="record-editor" aria-label={t('record.editor.label')}>
      <header className="record-editor__header">
        <h2 className="record-editor__entry-kind">
          {t(`record.editor.entryKind.${kind}`)}
        </h2>
        <div
          className="record-editor__status meta-text"
          role={editor.status === 'failed' ? 'alert' : 'status'}
          aria-live="polite"
        >
          {status}
          {editor.status === 'failed' && !editor.creating ? (
            <button
              type="button"
              className="button"
              onClick={editor.object ? editor.retrySave : editor.retryLoad}
            >
              {t(
                editor.object
                  ? 'record.editor.retrySave'
                  : 'record.editor.retry',
              )}
            </button>
          ) : null}
        </div>
      </header>
      {editor.status === 'conflicted' && editor.conflict ? (
        <div className="record-editor__conflict" role="alert">
          <h3>{t(`record.${kind}.conflictTitle`)}</h3>
          <p>{t(`record.${kind}.conflictDetail`)}</p>
          {editor.creating ? null : (
            <div className="record-editor__conflict-actions">
              <button
                type="button"
                className="button"
                onClick={editor.saveMine}
              >
                {t(`record.${kind}.conflictSaveMine`)}
              </button>
              <button
                type="button"
                className="button button--secondary"
                onClick={editor.useArchiveVersion}
              >
                {t(`record.${kind}.conflictUseArchive`)}
              </button>
            </div>
          )}
        </div>
      ) : null}
      <Suspense
        fallback={
          <div className="record-editor__surface record-editor__surface--loading" />
        }
      >
        <WritingSurface
          key={editor.object?.summary.id ?? `new-${kind}`}
          value={draft?.markdown ?? ''}
          disabled={disabled}
          onChange={(markdown) => editor.update({ markdown })}
        />
      </Suspense>
    </section>
  )
}
