/**
 * Record's primary region: one exact destination above its Markdown buffer.
 */

import { useTranslate } from '../../i18n'
import { MarkdownEditor } from './editor'
import { EventWritingEditor } from './events'
import { useRecordDestination } from './recordDestination'
import { SpanWritingEditor } from './spans'

export function RecordPage() {
  const t = useTranslate()
  const { client, cursor, objects, events, spans, developmentMock } =
    useRecordDestination()
  const window = cursor.state.view?.window ?? null
  const eventActive =
    events.creating || objects.state.selected?.placement.kind === 'event'
  const spanActive =
    spans.creating || objects.state.selected?.placement.kind === 'span'
  const structuredActive = eventActive || spanActive
  return (
    <div className="record-page">
      <h1 className="display-large">{t('record.page.title')}</h1>
      {/*
        Both controllers stay mounted while the selection changes. The hidden
        ordinary surface therefore keeps its exact in-memory buffer while an
        Event is inspected, just as the Event cache keeps drafts by stable ID.
      */}
      <div hidden={structuredActive}>
        <MarkdownEditor
          client={client}
          window={window}
          selected={structuredActive ? null : objects.state.selected}
          developmentMock={developmentMock}
        />
      </div>
      <div hidden={!eventActive}>
        <EventWritingEditor event={events} />
      </div>
      <div hidden={!spanActive}>
        <SpanWritingEditor span={spans} />
      </div>
    </div>
  )
}
