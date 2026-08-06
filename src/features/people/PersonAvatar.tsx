import { useEffect, useMemo, useState } from 'react'
import type { LifeArchiveClient, PersonProfilePhoto } from '../../core/client'
import { useTranslate } from '../../i18n'
import { personInitials } from './personPresentation'

export function PersonAvatar({
  client,
  name,
  photo,
  size = 'medium',
}: {
  readonly client: LifeArchiveClient
  readonly name: string
  readonly photo: PersonProfilePhoto | null
  readonly size?: 'small' | 'medium' | 'large'
}) {
  const t = useTranslate()
  const initials = useMemo(() => personInitials(name), [name])
  const [loaded, setLoaded] = useState<{
    readonly photoId: string
    readonly source: string
  } | null>(null)

  useEffect(() => {
    let active = true
    let url: string | null = null
    if (!photo) return () => undefined
    void client.media.content({ mediaId: photo.id }).then((result) => {
      if (!active || result.status === 'failed') return
      const bytes = new Uint8Array(result.value.bytes)
      url = URL.createObjectURL(
        new Blob([bytes.buffer], { type: photo.mimeType }),
      )
      setLoaded({ photoId: photo.id, source: url })
    })
    return () => {
      active = false
      if (url) URL.revokeObjectURL(url)
    }
  }, [client, photo])
  const source =
    loaded && photo && loaded.photoId === photo.id ? loaded.source : null

  return (
    <span className="person-avatar" data-size={size}>
      {source ? (
        <img src={source} alt={t('people.photo.alt', { name })} />
      ) : (
        <span
          role="img"
          aria-label={t('people.initials.alt', { name, initials })}
        >
          {initials}
        </span>
      )}
    </span>
  )
}
