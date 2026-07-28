import type { SemanticId } from '../../../core/client'
import { semanticName, useLocalisation } from '../../../i18n'
import {
  MATERIAL_UI_GLYPHS,
  materialIconFor,
} from '../metadata/semanticCatalog'

export function RecordSemanticIcon({
  id,
  className,
  decorative = false,
}: {
  readonly id: SemanticId
  readonly className?: string
  readonly decorative?: boolean
}) {
  const localisation = useLocalisation()
  const name = semanticName(localisation, 'record', 'icon', id)
  const materialIcon = materialIconFor(id)
  const glyph = materialIcon ?? MATERIAL_UI_GLYPHS.unknown

  return (
    <span
      className={['record-semantic-icon', className].filter(Boolean).join(' ')}
      data-semantic-icon-id={id}
      data-material-icon={glyph}
      role={decorative ? undefined : 'img'}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : name.accessibleName}
    >
      <span className="material-symbols-rounded" aria-hidden="true">
        {glyph}
      </span>
    </span>
  )
}
