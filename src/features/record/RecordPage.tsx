/**
 * Record's primary region: one exact destination above its Markdown buffer.
 */

import { useTranslate } from '../../i18n'
import { MarkdownEditor } from './editor'
import { useRecordDestination } from './recordDestination'

export function RecordPage() {
  const t = useTranslate()
  const { client, cursor, objects, developmentMock } = useRecordDestination()
  const window = cursor.state.view?.window ?? null
  return (
    <div className="record-page">
      <h1 className="display-large">{t('record.page.title')}</h1>
      <MarkdownEditor
        client={client}
        window={window}
        selected={objects.state.selected}
        developmentMock={developmentMock}
      />
    </div>
  )
}
