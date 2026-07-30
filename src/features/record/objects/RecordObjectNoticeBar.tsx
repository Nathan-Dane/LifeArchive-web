/**
 * What happened to the object a reader asked for.
 *
 * The rule this exists to keep is that a selection is never quietly swapped.
 * When the object being worked on is not one the core placed at this location
 * — its dates lie elsewhere, it has been deleted, it is not in this archive,
 * or it could not be read — the ordinary entry becomes the selection and this
 * says so, naming the exact object rather than leaving the reader to notice
 * that the writing surface changed under them.
 *
 * Where following the object is meaningful, one control does exactly that: it
 * moves to the object's own civil location and selects it again. A tombstone
 * gets no such control, because there is nowhere useful to arrive.
 */

import { failureMessage, useLocalisation } from '../../../i18n'
import type { RecordObjects } from './recordObjects'

export function RecordObjectNoticeBar({
  objects,
}: {
  readonly objects: RecordObjects
}) {
  const localisation = useLocalisation()
  const t = localisation.t
  const notice = objects.state.notice
  if (!notice) return null

  const message =
    notice.reason === 'elsewhere'
      ? t('record.objects.notice.elsewhere', { title: notice.object.title })
      : notice.reason === 'deleted'
        ? t('record.objects.notice.deleted', { title: notice.object.title })
        : notice.reason === 'missing'
          ? t('record.objects.notice.missing')
          : failureMessage(localisation, notice.failure)

  return (
    <div className="record-objects__notice" role="status">
      <p className="record-objects__message">{message}</p>
      {notice.reason === 'elsewhere' ? (
        <button
          type="button"
          className="button ui-text"
          onClick={() => objects.goToObject(notice.object)}
        >
          {t('record.objects.notice.goTo', { title: notice.object.title })}
        </button>
      ) : null}
      <button
        type="button"
        className="record-objects__dismiss ui-text"
        onClick={objects.dismissNotice}
      >
        {t('record.objects.notice.dismiss')}
      </button>
    </div>
  )
}
