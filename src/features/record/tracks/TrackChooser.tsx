import { stableId, type StableId } from '../../../core/client'
import { useTranslate } from '../../../i18n'
import type { Tracks } from './useTracks'

export function TrackChooser({
  tracks,
  value,
  disabled = false,
  onChange,
}: {
  readonly tracks: Tracks
  readonly value: string
  readonly disabled?: boolean
  readonly onChange: (trackId: StableId | null) => void
}) {
  const t = useTranslate()
  return (
    <select
      value={value}
      disabled={disabled || tracks.state.status === 'loading'}
      onChange={(event) =>
        onChange(
          event.currentTarget.value.length > 0
            ? stableId(event.currentTarget.value)
            : null,
        )
      }
    >
      <option value="">{t('record.track.none')}</option>
      {tracks.state.tracks
        .filter(({ track }) => !track.isArchived || track.id === value)
        .map(({ track }) => (
          <option key={track.id} value={track.id}>
            {track.name}
          </option>
        ))}
    </select>
  )
}
