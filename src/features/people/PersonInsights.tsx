import { Link } from 'react-router-dom'
import type { PersonMemorySummary } from '../../core/client'
import { useFormat, useLocalisation } from '../../i18n'
import type { People } from './usePeople'

export function PersonInsights({ people }: { readonly people: People }) {
  const t = useLocalisation().t
  const format = useFormat()
  return (
    <>
      <section className="person-card person-derived">
        <h3>{t('people.memories')}</h3>
        {people.state.memories.length === 0 ? (
          <p>{t('people.memories.empty')}</p>
        ) : (
          <ul>
            {people.state.memories.map((memory) => (
              <li key={memory.entryId}>
                <MemoryLink memory={memory} />
              </li>
            ))}
          </ul>
        )}
        {people.state.memoriesHasMore ? (
          <button
            type="button"
            className="button button--secondary"
            onClick={() => void people.loadMoreMemories()}
          >
            {t('people.memories.more')}
          </button>
        ) : null}
      </section>
      <section className="person-card person-derived">
        <h3>{t('people.contact')}</h3>
        {people.state.contactSummary?.lastRecordedContactDate ? (
          <>
            <p>
              {t('people.contact.last', {
                date: format.civilDate(
                  people.state.contactSummary.lastRecordedContactDate,
                  'medium',
                ),
              })}
            </p>
            <p>
              {t('people.contact.current', {
                count: people.state.contactSummary.current30DayContactDays,
              })}
            </p>
            <p>
              {t('people.contact.previous', {
                count: people.state.contactSummary.previous30DayContactDays,
              })}
            </p>
            <p>
              {t('people.contact.timeTogether', {
                count: people.state.contactSummary.current30DayTimeTogetherDays,
              })}
            </p>
          </>
        ) : (
          <p>{t('people.contact.none')}</p>
        )}
        <fieldset className="person-contact-ranges">
          <legend>{t('people.contact.history')}</legend>
          {(['thirtyDays', 'sixMonths', 'all'] as const).map((range) => (
            <button
              key={range}
              type="button"
              aria-pressed={people.state.contactRange === range}
              onClick={() => void people.loadContactHistory(range)}
            >
              {t(`people.contact.range.${range}`)}
            </button>
          ))}
        </fieldset>
        {people.state.contactHistory ? (
          <>
            <p>
              {t('people.contact.historyTotals', {
                contact: people.state.contactHistory.totalContactDays,
                together: people.state.contactHistory.totalTimeTogetherDays,
              })}
            </p>
            {people.state.contactHistory.periodSummaries.length > 0 ? (
              <ul className="person-contact-periods">
                {people.state.contactHistory.periodSummaries.map((period) => (
                  <li key={`${period.startDate}-${period.endDate}`}>
                    {t('people.contact.period', {
                      start: format.civilDate(period.startDate, 'medium'),
                      end: format.civilDate(period.endDate, 'medium'),
                      contact: period.contactDays,
                      together: period.timeTogetherDays,
                    })}
                  </li>
                ))}
              </ul>
            ) : null}
            <ul>
              {people.state.contactHistory.days.map((day) => (
                <li key={day.date}>
                  <strong>{format.civilDate(day.date, 'medium')}</strong>
                  <span className="meta-text">
                    {t(`record.people.interaction.${day.interactionLevel}`)}
                  </span>
                  <ul>
                    {day.memories.map((memory) => (
                      <li key={memory.entryId}>
                        <MemoryLink memory={memory} />
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </>
        ) : null}
        {people.state.contactHistory?.hasMore ? (
          <button
            type="button"
            className="button button--secondary"
            onClick={() =>
              void people.loadContactHistory(people.state.contactRange, true)
            }
          >
            {t('people.contact.more')}
          </button>
        ) : null}
      </section>
    </>
  )
}

function MemoryLink({ memory }: { readonly memory: PersonMemorySummary }) {
  const localisation = useLocalisation()
  const t = localisation.t
  const format = useFormat()
  const end = memory.civilEndDate
    ? t('people.memory.range', {
        start: format.civilDate(memory.civilStartDate, 'medium'),
        end: format.civilDate(memory.civilEndDate, 'medium'),
      })
    : format.civilDate(memory.civilStartDate, 'medium')
  const context = [
    t(`record.people.interaction.${memory.interactionLevel}`),
    ...(memory.tookPart ? [t('record.people.tookPart')] : []),
    ...(memory.isSubject ? [t('record.people.isSubject')] : []),
    ...(memory.hasWriting ? [t('people.memory.hasWriting')] : []),
  ].join(`${t('people.memory.contextSeparator')} `)
  return (
    <div className="person-memory">
      <Link to={memoryDestination(memory)}>
        {memory.title ?? format.civilDate(memory.civilStartDate, 'medium')}
      </Link>
      <span className="meta-text">
        {t('people.memory.detail', {
          kind: t(memoryKindMessage(memory.entryType)),
          range: end,
          context,
        })}
      </span>
    </div>
  )
}

function memoryKindMessage(
  kind: PersonMemorySummary['entryType'],
):
  | 'people.memory.kind.day'
  | 'people.memory.kind.week'
  | 'people.memory.kind.monthRecord'
  | 'people.memory.kind.year'
  | 'people.memory.kind.event'
  | 'people.memory.kind.span' {
  return kind === 'month'
    ? 'people.memory.kind.monthRecord'
    : `people.memory.kind.${kind}`
}

function memoryDestination(memory: PersonMemorySummary): string {
  if (memory.entryType === 'event' || memory.entryType === 'span') {
    return `/record?scale=day&date=${memory.civilStartDate}&object=${encodeURIComponent(memory.entryId)}`
  }
  return `/record?scale=${memory.entryType}&date=${memory.civilStartDate}`
}
