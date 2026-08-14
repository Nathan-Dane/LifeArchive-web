/**
 * Record's primary region: one exact destination above its Markdown buffer.
 */

import type { CivilDate, StableId, StructuredObject } from '../../core/client'
import { useTranslate } from '../../i18n'
import { deviceCalendar } from '../../platform/calendar'
import { MarkdownEditor, StructuredWritingEditor } from './editor'
import { useRecordDestination } from './recordDestination'
import { RecordMedia } from './media'
import { RecordPeopleSection } from '../people'

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

export interface RecordPageProps {
  readonly onViewPerson?: (
    personId: StableId,
    opener: HTMLButtonElement,
  ) => void
  readonly onEditPerson?: (
    personId: StableId,
    opener: HTMLButtonElement,
  ) => void
}

export function RecordPage({
  onViewPerson,
  onEditPerson,
}: RecordPageProps = {}) {
  const t = useTranslate()
  const {
    client,
    cursor,
    objects,
    events,
    spans,
    developmentMock,
    navigationSummary,
    flushBeforeExit,
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
  const viewPerson = onViewPerson
    ? (personId: StableId, opener: HTMLButtonElement) =>
        flushBeforeExit(() => onViewPerson(personId, opener))
    : undefined
  const editPerson = onEditPerson
    ? (personId: StableId, opener: HTMLButtonElement) =>
        flushBeforeExit(() => onEditPerson(personId, opener))
    : undefined
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
          onViewPerson={viewPerson}
          onEditPerson={editPerson}
        />
      </div>
      <div hidden={!eventActive}>
        <StructuredWritingEditor kind="event" editor={events} />
        <RecordMedia
          client={client}
          ownerId={events.creating ? null : (events.object?.summary.id ?? null)}
          parentRevision={
            events.creating ? null : (events.object?.summary.revision ?? null)
          }
          developmentMock={developmentMock}
          onParentRevision={events.adoptMediaRevision}
          onCountChange={navigationSummary.reportMediaCount}
        />
        <RecordPeopleSection
          client={client}
          target={
            events.creating || !events.object
              ? null
              : { kind: 'entry', entryId: events.object.summary.id }
          }
          entryKind="event"
          contactDateBounds={structuredContactBounds(events.object)}
          onEntryRevision={(_entryId, revision) =>
            events.adoptMediaRevision(revision)
          }
          onViewPerson={viewPerson}
          onEditPerson={editPerson}
        />
      </div>
      <div hidden={!spanActive}>
        <StructuredWritingEditor kind="span" editor={spans} />
        <RecordMedia
          client={client}
          ownerId={spans.creating ? null : (spans.object?.summary.id ?? null)}
          parentRevision={
            spans.creating ? null : (spans.object?.summary.revision ?? null)
          }
          developmentMock={developmentMock}
          onParentRevision={spans.adoptMediaRevision}
          onCountChange={navigationSummary.reportMediaCount}
        />
        <RecordPeopleSection
          client={client}
          target={
            spans.creating || !spans.object
              ? null
              : { kind: 'entry', entryId: spans.object.summary.id }
          }
          entryKind="span"
          contactDateBounds={structuredContactBounds(spans.object)}
          onEntryRevision={(_entryId, revision) =>
            spans.adoptMediaRevision(revision)
          }
          onViewPerson={viewPerson}
          onEditPerson={editPerson}
        />
      </div>
    </div>
  )
}

function structuredContactBounds(
  object: StructuredObject | null,
): { readonly minimum: CivilDate; readonly maximum: CivilDate } | undefined {
  if (!object) return undefined
  const placement = object.summary.placement
  return placement.kind === 'event'
    ? { minimum: placement.date, maximum: placement.date }
    : {
        minimum: placement.startDate,
        maximum: placement.endDate ?? deviceCalendar().today(),
      }
}
