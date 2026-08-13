import type { RefObject } from 'react'
import { RecordControlIcon } from '../../ui/overlay'

export function PeopleTaskHeader({
  headingId,
  title,
  closeLabel,
  closeRef,
  disabled = false,
  onClose,
}: {
  readonly headingId: string
  readonly title: string
  readonly closeLabel: string
  readonly closeRef?: RefObject<HTMLButtonElement | null>
  readonly disabled?: boolean
  readonly onClose: () => void
}) {
  return (
    <header className="record-overlay__header people-task-header">
      <button
        ref={closeRef}
        type="button"
        className="record-overlay__close"
        aria-label={closeLabel}
        disabled={disabled}
        onClick={onClose}
      >
        <RecordControlIcon name="close" />
      </button>
      <h2 id={headingId}>{title}</h2>
      <span aria-hidden="true" />
    </header>
  )
}
