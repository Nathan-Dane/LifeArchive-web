/**
 * Record's primary region: one exact destination above its Markdown buffer.
 */

import { useTranslate } from '../../i18n'
import { MarkdownEditor } from './editor'
import { EventWritingEditor } from './events'
import { useRecordDestination } from './recordDestination'
import { SpanWritingEditor } from './spans'
import { RecordMedia } from './media'

const ORDINARY_TITLE = {
  day: 'record.objects.ordinaryDay',
  week: 'record.objects.ordinaryWeek',
  month: 'record.objects.ordinaryMonth',
  year: 'record.objects.ordinaryYear',
} as const

const ORDINARY_ENTRY_KIND = {
  day: 'record.editor.entryKind.scaleDay',
  week: 'record.editor.entryKind.scaleWeek',
  month: 'record.editor.entryKind.scaleMonth',
  year: 'record.editor.entryKind.scaleYear',
} as const

export function RecordPage() {
  const t = useTranslate()
  const {
    client,
    cursor,
    objects,
    events,
    spans,
    developmentMock,
    navigationSummary,
  } = useRecordDestination()
  const window = cursor.state.view?.window ?? null
  const eventActive =
    events.creating || objects.state.selected?.placement.kind === 'event'
  const spanActive =
    spans.creating || objects.state.selected?.placement.kind === 'span'
  const structuredActive = eventActive || spanActive
  const selected = objects.state.selected
  const eventTitle =
    events.draft?.title.trim() ||
    (selected?.placement.kind === 'event' ? selected.title : '') ||
    t('record.event.new')
  const spanTitle =
    spans.draft?.title.trim() ||
    (selected?.placement.kind === 'span' ? selected.title : '') ||
    t('record.span.new')
  const pageTitle = eventActive
    ? eventTitle
    : spanActive
      ? spanTitle
      : t(ORDINARY_TITLE[cursor.state.scale])
  return (
    <div className="record-page">
      <header className="record-page__header">
        <h1 className="visually-hidden">{t('record.page.title')}</h1>
        <h2 className="record-page__title">{pageTitle}</h2>
      </header>
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
          heading={t(ORDINARY_ENTRY_KIND[cursor.state.scale])}
          onSummaryChange={(text) => {
            if (window) navigationSummary.reportOrdinaryText(window.id, text)
          }}
          onMediaCountChange={(ownerId, count) => {
            if (window) {
              navigationSummary.reportMediaCount(ownerId, count, window.id)
            }
          }}
          developmentMock={developmentMock}
          allowMedia={cursor.state.scale === 'day'}
        />
      </div>
      <div hidden={!eventActive}>
        <EventWritingEditor event={events} />
        <RecordMedia
          client={client}
          ownerId={events.creating ? null : (events.object?.summary.id ?? null)}
          developmentMock={developmentMock}
          onParentRevision={events.adoptMediaRevision}
          onCountChange={navigationSummary.reportMediaCount}
        />
      </div>
      <div hidden={!spanActive}>
        <SpanWritingEditor span={spans} />
        <RecordMedia
          client={client}
          ownerId={spans.creating ? null : (spans.object?.summary.id ?? null)}
          developmentMock={developmentMock}
          onParentRevision={spans.adoptMediaRevision}
          onCountChange={navigationSummary.reportMediaCount}
        />
      </div>
    </div>
  )
}
