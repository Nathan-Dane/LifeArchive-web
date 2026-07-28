import type { SemanticId } from '../../../core/client'
import { semanticName, useLocalisation } from '../../../i18n'

/**
 * The one presentation boundary between a core semantic icon ID and a web
 * glyph. Step 43 will fill this adapter from the runtime catalogue. Until
 * then, IDs are preserved and announced exactly, while the neutral mark makes
 * no claim that a particular web icon has already been assigned.
 */
export function RecordSemanticIcon({
  id,
  className,
}: {
  readonly id: SemanticId
  readonly className?: string
}) {
  const localisation = useLocalisation()
  const name = semanticName(localisation, 'record', 'icon', id)

  return (
    <span
      className={className}
      data-semantic-icon-id={id}
      role="img"
      aria-label={name.accessibleName}
    >
      <span aria-hidden="true">
        {localisation.t('record.icon.fallbackGlyph')}
      </span>
    </span>
  )
}
