import { useId, useRef, useState, type RefObject } from 'react'
import { Link } from 'react-router-dom'
import type {
  LifeArchiveClient,
  PersonMemorySummary,
  PersonDate,
  PersonDatePrecision,
  PersonOtherName,
  PersonProfile,
  PersonReference,
  PersonSnapshot,
} from '../../core/client'
import { failureMessage, useFormat, useLocalisation } from '../../i18n'
import { RecordControlIcon } from '../../ui/overlay'
import { ConnectionLabelsEditor } from './ConnectionLabelsEditor'
import { PersonAvatar } from './PersonAvatar'
import type { People } from './usePeople'

const OTHER_NAME_KINDS = [
  'nickname',
  'formerName',
  'birthName',
  'alternateSpelling',
  'anotherScript',
  'other',
] as const

const REFERENCE_KINDS = [
  'personalWebsite',
  'socialProfile',
  'professionalProfile',
  'memorial',
  'other',
] as const

export function PersonDetails({
  client,
  people,
  headingId,
  closeRef,
  onBack,
  onClose,
  onCreated,
  onChanged,
}: {
  readonly client: LifeArchiveClient
  readonly people: People
  readonly headingId: string
  readonly closeRef: RefObject<HTMLButtonElement | null>
  readonly onBack?: () => void
  readonly onClose: () => void
  readonly onCreated?: (
    snapshot: PersonSnapshot,
  ) => void | boolean | Promise<void | boolean>
  readonly onChanged?: () => void
}) {
  const localisation = useLocalisation()
  const t = localisation.t
  const format = useFormat()
  const nameId = useId()
  const nameErrorId = useId()
  const photoInput = useRef<HTMLInputElement>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [mergeOpen, setMergeOpen] = useState(false)
  const [mergeDuplicate, setMergeDuplicate] = useState('')
  const [displayNameSource, setDisplayNameSource] = useState<
    'retained' | 'duplicate'
  >('retained')
  const [aboutSource, setAboutSource] = useState<
    'retained' | 'duplicate' | 'combined'
  >('retained')
  const [photoSource, setPhotoSource] = useState<
    'retained' | 'duplicate' | 'none'
  >('retained')
  const [createdHandoffFailed, setCreatedHandoffFailed] = useState(false)
  const draft = people.state.draft
  const selected = people.state.selected
  if (!draft) return null
  const busy = people.state.status === 'saving'
  const valid = /\S/u.test(draft.displayName)
  const mergeCandidates = people.state.people.filter(
    ({ person }) => person.id !== selected?.person.id && !person.isArchived,
  )

  const save = async () => {
    if (people.state.creating) {
      const created = await people.create()
      if (created) {
        const accepted = await onCreated?.(created.snapshot)
        setCreatedHandoffFailed(accepted === false)
      }
      return
    }
    if (await people.save()) onChanged?.()
  }

  return (
    <>
      <header className="record-overlay__header person-editor__header">
        {onBack ? (
          <button
            type="button"
            className="record-overlay__back"
            aria-label={t('people.back')}
            onClick={onBack}
          >
            <RecordControlIcon name="back" />
          </button>
        ) : null}
        <div>
          <h2 id={headingId} className="ui-heading">
            {t(
              people.state.creating
                ? 'people.create.heading'
                : 'people.edit.heading',
            )}
          </h2>
          <p className="meta-text">
            {t(
              people.state.creating
                ? 'people.create.detail'
                : 'people.edit.detail',
            )}
          </p>
        </div>
        <button
          ref={closeRef}
          type="button"
          className="record-overlay__close"
          aria-label={t('people.close.editor')}
          onClick={onClose}
        >
          <RecordControlIcon name="close" />
        </button>
      </header>

      <div className="person-editor__body">
        {people.state.failure ? (
          <div role="alert" className="record-details__failure">
            <p>
              {t('people.failure.kept')}{' '}
              {failureMessage(localisation, people.state.failure)}
            </p>
            {people.state.pendingMutation ? (
              <button
                type="button"
                className="button"
                onClick={() => void people.retryMutation()}
              >
                {t('people.retry')}
              </button>
            ) : null}
          </div>
        ) : null}
        {people.state.pendingMutation &&
        people.state.status === 'ready' &&
        !people.state.conflict ? (
          <div className="record-editor__conflict" role="alert">
            <h3>{t('people.mutationConflict.title')}</h3>
            <p>{t('people.mutationConflict.detail')}</p>
            <div className="record-editor__conflict-actions">
              <button
                type="button"
                className="button"
                onClick={() => void people.retryMutation()}
              >
                {t('people.retry')}
              </button>
              <button
                type="button"
                className="button button--secondary"
                onClick={people.dismissMutationConflict}
              >
                {t('people.conflict.useArchive')}
              </button>
            </div>
          </div>
        ) : null}
        {createdHandoffFailed ? (
          <p role="alert" className="record-details__failure">
            {t('people.created.linkFailed')}
          </p>
        ) : null}
        {people.state.conflict ? (
          <div className="record-editor__conflict" role="alert">
            <h3>{t('people.conflict.title')}</h3>
            <p>{t('people.conflict.detail')}</p>
            <div className="record-editor__conflict-actions">
              <button
                type="button"
                className="button"
                onClick={people.saveMine}
              >
                {t('people.conflict.saveMine')}
              </button>
              <button
                type="button"
                className="button button--secondary"
                onClick={people.useArchiveVersion}
              >
                {t('people.conflict.useArchive')}
              </button>
            </div>
          </div>
        ) : null}

        <section className="person-card person-card--identity">
          <div className="person-photo-editor">
            <PersonAvatar
              client={client}
              name={draft.displayName || t('people.create.heading')}
              photo={selected?.profilePhoto ?? null}
              size="large"
            />
            {!people.state.creating ? (
              <div>
                <input
                  ref={photoInput}
                  className="visually-hidden"
                  type="file"
                  accept="image/*"
                  aria-label={t('people.photo.change')}
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0]
                    if (file) void people.importPhoto(file)
                    event.currentTarget.value = ''
                  }}
                />
                <button
                  type="button"
                  className="button button--secondary"
                  disabled={busy}
                  onClick={() => photoInput.current?.click()}
                >
                  {t('people.photo.change')}
                </button>
                {selected?.profilePhoto ? (
                  <button
                    type="button"
                    className="button button--secondary"
                    disabled={busy}
                    onClick={() => void people.removePhoto()}
                  >
                    {t('people.photo.remove')}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
          <label className="person-field" htmlFor={nameId}>
            <span className="meta-text">{t('people.name')}</span>
            <input
              id={nameId}
              value={draft.displayName}
              disabled={busy}
              aria-invalid={!valid}
              aria-describedby={!valid ? nameErrorId : undefined}
              onChange={(event) =>
                people.update({ displayName: event.currentTarget.value })
              }
            />
          </label>
          {!valid ? (
            <span id={nameErrorId} className="meta-text">
              {t('people.name.required')}
            </span>
          ) : null}
          <ConnectionLabelsEditor
            labels={draft.connectionLabels}
            disabled={busy}
            onChange={(connectionLabels) => people.update({ connectionLabels })}
          />
          <label className="person-field">
            <span className="meta-text">{t('people.about')}</span>
            <textarea
              value={draft.about ?? ''}
              disabled={busy}
              rows={4}
              onChange={(event) =>
                people.update({ about: event.currentTarget.value || null })
              }
            />
          </label>
        </section>

        <section className="person-card">
          <h3 className="eyebrow">{t('people.names')}</h3>
          <label className="person-field">
            <span className="meta-text">{t('people.pronunciation')}</span>
            <input
              value={draft.pronunciation ?? ''}
              disabled={busy}
              onChange={(event) =>
                people.update({
                  pronunciation: event.currentTarget.value || null,
                })
              }
            />
          </label>
          <label className="person-field">
            <span className="meta-text">{t('people.pronouns')}</span>
            <input
              value={draft.pronouns ?? ''}
              disabled={busy}
              onChange={(event) =>
                people.update({ pronouns: event.currentTarget.value || null })
              }
            />
          </label>
          <div className="person-repeat">
            <span className="meta-text">{t('people.otherNames')}</span>
            {draft.otherNames.map((name, index) => (
              <OtherNameRow
                key={index}
                index={index}
                name={name}
                disabled={busy}
                onChange={(value) =>
                  people.update({
                    otherNames: draft.otherNames.map((current, item) =>
                      item === index ? value : current,
                    ),
                  })
                }
                onRemove={() =>
                  people.update({
                    otherNames: draft.otherNames.filter(
                      (_, item) => item !== index,
                    ),
                  })
                }
              />
            ))}
            <button
              type="button"
              className="button button--secondary"
              disabled={busy}
              onClick={() =>
                people.update({
                  otherNames: [
                    ...draft.otherNames,
                    { kindId: 'nickname', value: '' },
                  ],
                })
              }
            >
              <RecordControlIcon name="add" />
              <span>{t('people.otherNames.add')}</span>
            </button>
          </div>
        </section>

        <section className="person-card">
          <h3 className="eyebrow">{t('people.life')}</h3>
          <label className="person-field">
            <span className="meta-text">{t('people.life.status')}</span>
            <select
              value={draft.lifeStatus}
              disabled={busy}
              onChange={(event) =>
                people.update({
                  lifeStatus: event.currentTarget
                    .value as PersonProfile['lifeStatus'],
                })
              }
            >
              <option value="notSpecified">
                {t('people.life.status.notSpecified')}
              </option>
              <option value="living">{t('people.life.status.living')}</option>
              <option value="deceased">
                {t('people.life.status.deceased')}
              </option>
            </select>
          </label>
          <PartialDateEditor
            label={t('people.birth')}
            value={draft.birthDate}
            disabled={busy}
            onChange={(birthDate) => people.update({ birthDate })}
          />
          <PartialDateEditor
            label={t('people.death')}
            value={draft.deathDate}
            disabled={busy}
            onChange={(deathDate) => people.update({ deathDate })}
          />
        </section>

        <section className="person-card">
          <h3 className="eyebrow">{t('people.references')}</h3>
          {draft.references.map((reference, index) => (
            <ReferenceRow
              key={index}
              index={index}
              reference={reference}
              disabled={busy}
              onChange={(value) =>
                people.update({
                  references: draft.references.map((current, item) =>
                    item === index ? value : current,
                  ),
                })
              }
              onRemove={() =>
                people.update({
                  references: draft.references.filter(
                    (_, item) => item !== index,
                  ),
                })
              }
            />
          ))}
          <button
            type="button"
            className="button button--secondary"
            disabled={busy}
            onClick={() =>
              people.update({
                references: [
                  ...draft.references,
                  { kindId: 'personalWebsite', label: null, url: '' },
                ],
              })
            }
          >
            <RecordControlIcon name="add" />
            <span>{t('people.references.add')}</span>
          </button>
        </section>

        {!people.state.creating && selected ? (
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
                      count:
                        people.state.contactSummary.current30DayContactDays,
                    })}
                  </p>
                  <p>
                    {t('people.contact.previous', {
                      count:
                        people.state.contactSummary.previous30DayContactDays,
                    })}
                  </p>
                  <p>
                    {t('people.contact.timeTogether', {
                      count:
                        people.state.contactSummary
                          .current30DayTimeTogetherDays,
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
                      together:
                        people.state.contactHistory.totalTimeTogetherDays,
                    })}
                  </p>
                  {people.state.contactHistory.periodSummaries.length > 0 ? (
                    <ul className="person-contact-periods">
                      {people.state.contactHistory.periodSummaries.map(
                        (period) => (
                          <li key={`${period.startDate}-${period.endDate}`}>
                            {t('people.contact.period', {
                              start: format.civilDate(
                                period.startDate,
                                'medium',
                              ),
                              end: format.civilDate(period.endDate, 'medium'),
                              contact: period.contactDays,
                              together: period.timeTogetherDays,
                            })}
                          </li>
                        ),
                      )}
                    </ul>
                  ) : null}
                  <ul>
                    {people.state.contactHistory.days.map((day) => (
                      <li key={day.date}>
                        <strong>{format.civilDate(day.date, 'medium')}</strong>
                        <span className="meta-text">
                          {t(
                            `record.people.interaction.${day.interactionLevel}`,
                          )}
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
                    void people.loadContactHistory(
                      people.state.contactRange,
                      true,
                    )
                  }
                >
                  {t('people.contact.more')}
                </button>
              ) : null}
            </section>
          </>
        ) : null}

        {!people.state.creating && selected ? (
          <section className="person-card person-management-actions">
            <button
              type="button"
              className="button button--secondary"
              disabled={busy}
              onClick={() =>
                void people.setArchived(!selected.person.isArchived)
              }
            >
              {t(
                selected.person.isArchived
                  ? 'people.restore'
                  : 'people.archive',
              )}
            </button>
            <button
              type="button"
              className="button button--secondary"
              disabled={
                busy ||
                selected.person.isArchived ||
                mergeCandidates.length === 0
              }
              onClick={() => setMergeOpen((value) => !value)}
            >
              {t('people.merge')}
            </button>
            {mergeOpen ? (
              <div className="person-merge">
                <h3>{t('people.merge.heading')}</h3>
                {people.state.mergeConflict ? (
                  <p role="alert">{t('people.merge.conflict')}</p>
                ) : null}
                <label>
                  <span>{t('people.merge.duplicate')}</span>
                  <select
                    value={mergeDuplicate}
                    onChange={(event) =>
                      setMergeDuplicate(event.currentTarget.value)
                    }
                  >
                    <option value="" />
                    {mergeCandidates.map((candidate) => (
                      <option
                        key={candidate.person.id}
                        value={candidate.person.id}
                      >
                        {candidate.person.displayName}
                      </option>
                    ))}
                  </select>
                </label>
                <MergeChoice
                  label={t('people.merge.name')}
                  value={displayNameSource}
                  choices={['retained', 'duplicate']}
                  onChange={setDisplayNameSource}
                />
                <MergeChoice
                  label={t('people.merge.about')}
                  value={aboutSource}
                  choices={['retained', 'duplicate', 'combined']}
                  onChange={setAboutSource}
                />
                <MergeChoice
                  label={t('people.merge.photo')}
                  value={photoSource}
                  choices={['retained', 'duplicate', 'none']}
                  onChange={setPhotoSource}
                />
                <button
                  type="button"
                  className="button button--destructive"
                  disabled={!mergeDuplicate}
                  onClick={() => {
                    const duplicate = mergeCandidates.find(
                      ({ person }) => person.id === mergeDuplicate,
                    )
                    if (duplicate) {
                      void people.merge(duplicate, {
                        displayNameSource,
                        aboutSource,
                        photoSource,
                      })
                    }
                  }}
                >
                  {t('people.merge.confirm')}
                </button>
              </div>
            ) : null}
            {confirmDelete ? (
              <div className="record-details__delete-confirm" role="alert">
                <p>{t('people.delete.confirm')}</p>
                <button
                  type="button"
                  className="button button--destructive"
                  onClick={() => void people.deletePerson()}
                >
                  {t('people.delete')}
                </button>
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() => setConfirmDelete(false)}
                >
                  {t('people.cancel')}
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="button button--destructive"
                onClick={() => setConfirmDelete(true)}
              >
                {t('people.delete')}
              </button>
            )}
          </section>
        ) : null}
      </div>

      <footer className="record-overlay__footer person-editor__footer">
        <button
          type="button"
          className="button button--primary"
          disabled={!valid || busy}
          onClick={() => void save()}
        >
          {t(busy ? 'people.saving' : 'people.save')}
        </button>
      </footer>
    </>
  )
}

function OtherNameRow({
  index,
  name,
  disabled,
  onChange,
  onRemove,
}: {
  readonly index: number
  readonly name: PersonOtherName
  readonly disabled: boolean
  readonly onChange: (value: PersonOtherName) => void
  readonly onRemove: () => void
}) {
  const t = useLocalisation().t
  return (
    <div className="person-repeat__row">
      <select
        aria-label={t('people.otherNames.kindLabel', { number: index + 1 })}
        value={name.kindId}
        disabled={disabled}
        onChange={(event) =>
          onChange({ ...name, kindId: event.currentTarget.value })
        }
      >
        {OTHER_NAME_KINDS.map((kind) => (
          <option key={kind} value={kind}>
            {t(`people.otherNames.kind.${kind}`)}
          </option>
        ))}
      </select>
      <input
        aria-label={t('people.otherNames.valueLabel', { number: index + 1 })}
        value={name.value}
        disabled={disabled}
        onChange={(event) =>
          onChange({ ...name, value: event.currentTarget.value })
        }
      />
      <button
        type="button"
        disabled={disabled}
        aria-label={t('people.otherNames.removeNumbered', {
          number: index + 1,
        })}
        onClick={onRemove}
      >
        <RecordControlIcon name="close" />
      </button>
    </div>
  )
}

function ReferenceRow({
  index,
  reference,
  disabled,
  onChange,
  onRemove,
}: {
  readonly index: number
  readonly reference: PersonReference
  readonly disabled: boolean
  readonly onChange: (value: PersonReference) => void
  readonly onRemove: () => void
}) {
  const t = useLocalisation().t
  return (
    <div className="person-reference">
      <select
        aria-label={t('people.references.kindLabel', { number: index + 1 })}
        value={reference.kindId}
        disabled={disabled}
        onChange={(event) =>
          onChange({ ...reference, kindId: event.currentTarget.value })
        }
      >
        {REFERENCE_KINDS.map((kind) => (
          <option key={kind} value={kind}>
            {t(`people.references.kind.${kind}`)}
          </option>
        ))}
      </select>
      <input
        aria-label={t('people.references.labelNumbered', {
          number: index + 1,
        })}
        value={reference.label ?? ''}
        placeholder={t('people.references.label')}
        disabled={disabled}
        onChange={(event) =>
          onChange({ ...reference, label: event.currentTarget.value || null })
        }
      />
      <input
        type="url"
        aria-label={t('people.references.urlNumbered', { number: index + 1 })}
        value={reference.url}
        placeholder={t('people.references.url')}
        disabled={disabled}
        onChange={(event) =>
          onChange({ ...reference, url: event.currentTarget.value })
        }
      />
      <button
        type="button"
        disabled={disabled}
        aria-label={t('people.references.removeNumbered', {
          number: index + 1,
        })}
        onClick={onRemove}
      >
        <RecordControlIcon name="close" />
      </button>
    </div>
  )
}

function PartialDateEditor({
  label,
  value,
  disabled,
  onChange,
}: {
  readonly label: string
  readonly value: PersonDate | null
  readonly disabled: boolean
  readonly onChange: (value: PersonDate | null) => void
}) {
  const t = useLocalisation().t
  const precision = value?.precision ?? 'year'
  const updatePrecision = (next: PersonDatePrecision) => {
    const year = value?.year ?? new Date().getFullYear()
    onChange({
      precision: next,
      year,
      month: next === 'year' ? null : (value?.month ?? null),
      day: next === 'day' ? (value?.day ?? null) : null,
      approximate: value?.approximate ?? false,
    })
  }
  return (
    <fieldset className="person-date">
      <legend>{label}</legend>
      <label>
        <input
          type="checkbox"
          checked={value !== null}
          disabled={disabled}
          onChange={(event) =>
            event.currentTarget.checked
              ? updatePrecision('year')
              : onChange(null)
          }
        />
        <span>{value ? label : t('people.date.none')}</span>
      </label>
      {value ? (
        <div className="person-date__fields">
          <label>
            <span>{t('people.date.precision')}</span>
            <select
              value={precision}
              disabled={disabled}
              onChange={(event) =>
                updatePrecision(
                  event.currentTarget.value as PersonDatePrecision,
                )
              }
            >
              <option value="day">{t('people.date.precision.fullDate')}</option>
              <option value="month">
                {t('people.date.precision.monthYear')}
              </option>
              <option value="year">
                {t('people.date.precision.yearOnly')}
              </option>
            </select>
          </label>
          {precision === 'day' ? (
            <label>
              <span>{t('people.date.dayField')}</span>
              <input
                type="number"
                min="1"
                max="31"
                value={value.day ?? ''}
                disabled={disabled}
                onChange={(event) =>
                  onChange({
                    ...value,
                    day: event.currentTarget.valueAsNumber || null,
                  })
                }
              />
            </label>
          ) : null}
          {precision !== 'year' ? (
            <label>
              <span>{t('people.date.monthField')}</span>
              <input
                type="number"
                min="1"
                max="12"
                value={value.month ?? ''}
                disabled={disabled}
                onChange={(event) =>
                  onChange({
                    ...value,
                    month: event.currentTarget.valueAsNumber || null,
                  })
                }
              />
            </label>
          ) : null}
          <label>
            <span>{t('people.date.yearField')}</span>
            <input
              type="number"
              min="1"
              max="9999"
              value={value.year}
              disabled={disabled}
              onFocus={(event) => event.currentTarget.select()}
              onChange={(event) =>
                onChange({
                  ...value,
                  year: Number.isNaN(event.currentTarget.valueAsNumber)
                    ? value.year
                    : event.currentTarget.valueAsNumber,
                })
              }
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={value.approximate}
              disabled={disabled}
              onChange={(event) =>
                onChange({ ...value, approximate: event.currentTarget.checked })
              }
            />
            <span>{t('people.date.approximate')}</span>
          </label>
        </div>
      ) : null}
    </fieldset>
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

function MergeChoice<Value extends string>({
  label,
  value,
  choices,
  onChange,
}: {
  readonly label: string
  readonly value: Value
  readonly choices: readonly Value[]
  readonly onChange: (value: Value) => void
}) {
  const t = useLocalisation().t
  const labels = {
    retained: 'people.merge.retained',
    duplicate: 'people.merge.duplicateChoice',
    combined: 'people.merge.combine',
    none: 'people.merge.none',
  } as const
  return (
    <label>
      <span>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.currentTarget.value as Value)}
      >
        {choices.map((choice) => (
          <option key={choice} value={choice}>
            {t(labels[choice as keyof typeof labels])}
          </option>
        ))}
      </select>
    </label>
  )
}
