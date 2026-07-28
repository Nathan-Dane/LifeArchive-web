/**
 * Record's primary region: the row that chooses an object, above the surface
 * that will write it.
 *
 * The writing surface itself arrives with the editor. What is composed here is
 * the part that has to be right before there is anything to write into: the
 * one destination, shown in the region that never becomes a drawer, so the
 * exact object stays selected and visible at every width.
 */

import { useTranslate } from '../../i18n'
import { RecordObjectSwitcher } from './objects/RecordObjectSwitcher'
import { useRecordDestination } from './recordDestination'

export function RecordPage() {
  const t = useTranslate()
  const { cursor, objects } = useRecordDestination()
  return (
    <div className="record-page">
      <h1 className="display-large">{t('record.page.title')}</h1>
      <RecordObjectSwitcher
        scale={cursor.state.scale}
        window={cursor.state.view?.window ?? null}
        objects={objects}
      />
    </div>
  )
}
