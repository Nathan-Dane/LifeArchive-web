import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react'
import type {
  LifeArchiveClient,
  MediaItem,
  Revision,
  StableId,
} from '../../../core/client'
import {
  failureMessage,
  useFormat,
  useLocalisation,
  useTranslate,
} from '../../../i18n'
import { RecordControlIcon, RecordOverlay } from '../overlays'
import { safePreviewKind } from './previewUrlManager'
import { useRecordMedia } from './useRecordMedia'

export interface RecordMediaProps {
  readonly client: LifeArchiveClient
  readonly ownerId: StableId | null
  readonly developmentMock?: boolean
  readonly showBeforeOwnerExists?: boolean
  readonly onParentRevision?: (revision: Revision) => void
  readonly onCountChange?: (ownerId: StableId, count: number) => void
}

export function RecordMedia({
  client,
  ownerId,
  developmentMock = false,
  showBeforeOwnerExists = false,
  onParentRevision,
  onCountChange,
}: RecordMediaProps) {
  const t = useTranslate()
  const format = useFormat()
  const localisation = useLocalisation()
  const headingId = useId()
  const previewHeadingId = useId()
  const picker = useRef<HTMLInputElement>(null)
  const addButton = useRef<HTMLButtonElement>(null)
  const previewCloseButton = useRef<HTMLButtonElement>(null)
  const previewReturnFocus = useRef<HTMLButtonElement | null>(null)
  const cancelDeleteButton = useRef<HTMLButtonElement>(null)
  const deleteReturnFocus = useRef<HTMLButtonElement | null>(null)
  const [deleting, setDeleting] = useState<MediaItem | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [failedPreviewImage, setFailedPreviewImage] = useState<StableId | null>(
    null,
  )
  const media = useRecordMedia(client, { ownerId, onParentRevision })
  const displayedPreview = media.preview
  useEffect(() => {
    if (
      ownerId !== null &&
      media.listing.status === 'ready' &&
      media.listing.ownerId === ownerId
    ) {
      onCountChange?.(ownerId, media.listing.items.length)
    }
  }, [
    media.listing.items.length,
    media.listing.ownerId,
    media.listing.status,
    onCountChange,
    ownerId,
  ])
  const deletingForOwner = deleting?.parentEntryId === ownerId ? deleting : null
  useEffect(() => {
    if (deletingForOwner) cancelDeleteButton.current?.focus()
  }, [deletingForOwner])

  const chooseFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.currentTarget.files
      ? Array.from(event.currentTarget.files)
      : []
    event.currentTarget.value = ''
    void media.importFiles(files)
  }

  if (ownerId === null && !showBeforeOwnerExists) return null

  return (
    <section className="record-media" aria-labelledby={headingId}>
      <header className="record-media__header">
        <div className="record-media__heading">
          <h2 id={headingId} className="ui-heading">
            {t('record.media.heading')}
          </h2>
          {media.listing.status === 'ready' ? (
            <span
              className="record-media__count meta-text"
              aria-label={t('record.media.count', {
                count: media.listing.items.length,
              })}
            >
              {format.number(media.listing.items.length)}
            </span>
          ) : null}
        </div>
        <button
          ref={addButton}
          type="button"
          className="record-media__add"
          aria-label={t('record.media.add')}
          disabled={
            ownerId === null ||
            media.listing.status !== 'ready' ||
            media.progress !== null
          }
          onClick={() => picker.current?.click()}
        >
          <RecordControlIcon name="add" />
          <span>{t('record.media.addShort')}</span>
        </button>
        <input
          ref={picker}
          className="record-media__picker"
          type="file"
          multiple
          disabled={ownerId === null}
          aria-label={t('record.media.picker')}
          onChange={chooseFiles}
        />
      </header>

      {media.listing.status === 'loading' || media.progress || media.notice ? (
        <div className="record-media__status meta-text" role="status">
          {media.listing.status === 'loading'
            ? t('record.media.loading')
            : media.progress?.phase === 'reading'
              ? t('record.media.reading', { fileName: media.progress.fileName })
              : media.progress?.phase === 'importing'
                ? t('record.media.importing', {
                    fileName: media.progress.fileName,
                  })
                : media.notice === 'imported'
                  ? t(
                      developmentMock
                        ? 'record.media.importedMock'
                        : 'record.media.imported',
                    )
                  : media.notice === 'deleted'
                    ? t('record.media.deleted')
                    : media.notice === 'acquisitionFailed'
                      ? t('record.media.acquisitionFailed')
                      : null}
          {media.progress ? (
            <progress
              max={media.progress.byteSize || undefined}
              value={
                media.progress.byteSize > 0
                  ? media.progress.bytesRead
                  : undefined
              }
              aria-label={t('record.media.progress')}
            />
          ) : null}
        </div>
      ) : null}

      {media.listing.failure ? (
        <div className="record-media__failure" role="alert">
          <p>
            {t('record.media.listFailed', {
              detail: failureMessage(localisation, media.listing.failure),
            })}
          </p>
          <button type="button" className="button" onClick={media.retry}>
            {t('record.media.retry')}
          </button>
        </div>
      ) : null}
      {media.mutationFailure ? (
        <p className="record-media__failure" role="alert">
          {t('record.media.mutationFailed', {
            detail: failureMessage(localisation, media.mutationFailure),
          })}
        </p>
      ) : null}

      {ownerId === null ? (
        <p className="record-media__empty record-media__empty--unavailable">
          {t('record.media.ownerRequiredDetail')}
        </p>
      ) : media.listing.status === 'ready' &&
        media.listing.items.length === 0 ? (
        <p className="record-media__empty">{t('record.media.empty')}</p>
      ) : (
        <ul
          className="record-media__grid"
          aria-label={t('record.media.gallery')}
        >
          {media.listing.items.map((item) => (
            <RecordMediaCard
              key={item.id}
              client={client}
              item={item}
              metadata={t('record.media.itemMetadata', {
                kind: t(`record.media.kind.${item.kind}`),
                size: format.byteSize(item.byteSize),
              })}
              previewLabel={t('record.media.previewAction', {
                fileName: item.fileName,
              })}
              deleteLabel={t('record.media.deleteAction', {
                fileName: item.fileName,
              })}
              onPreview={(opener) => {
                previewReturnFocus.current = opener
                setPreviewOpen(true)
                void media.previewItem(item)
              }}
              onDelete={(opener) => {
                deleteReturnFocus.current = opener
                setDeleting(item)
              }}
            />
          ))}
        </ul>
      )}

      <RecordOverlay
        open={previewOpen && media.preview !== null}
        kind="modal"
        modalPlacement="center"
        labelledBy={previewHeadingId}
        anchorRef={previewReturnFocus}
        initialFocusRef={previewCloseButton}
        onClose={() => setPreviewOpen(false)}
        onClosed={media.closePreview}
        className="record-media__preview"
      >
        {displayedPreview ? (
          <>
            <header className="record-overlay__header record-media__preview-header">
              <div>
                <h3 id={previewHeadingId}>{displayedPreview.item.fileName}</h3>
                <p className="meta-text">
                  {t('record.media.previewMetadata', {
                    mimeType: displayedPreview.item.mimeType,
                    size: format.byteSize(displayedPreview.item.byteSize),
                  })}
                </p>
              </div>
              <button
                ref={previewCloseButton}
                type="button"
                className="record-overlay__close"
                aria-label={t('record.media.closePreview')}
                onClick={() => setPreviewOpen(false)}
              >
                <RecordControlIcon name="close" />
              </button>
            </header>
            <div className="record-media__preview-body">
              {displayedPreview.status === 'loading' ? (
                <p role="status">{t('record.media.previewLoading')}</p>
              ) : displayedPreview.status === 'failed' &&
                displayedPreview.failure ? (
                <p role="alert">
                  {t('record.media.previewFailed', {
                    detail: failureMessage(
                      localisation,
                      displayedPreview.failure,
                    ),
                  })}
                </p>
              ) : displayedPreview.status === 'unsupported' ? (
                <p>{t('record.media.previewUnsupported')}</p>
              ) : displayedPreview.url &&
                displayedPreview.kind === 'image' &&
                failedPreviewImage !== displayedPreview.item.id ? (
                <img
                  src={displayedPreview.url}
                  alt={t('record.media.previewAlt', {
                    fileName: displayedPreview.item.fileName,
                  })}
                  onError={() =>
                    setFailedPreviewImage(displayedPreview.item.id)
                  }
                />
              ) : displayedPreview.kind === 'image' ? (
                <p>{t('record.media.previewUnsupported')}</p>
              ) : displayedPreview.url && displayedPreview.kind === 'video' ? (
                <video src={displayedPreview.url} controls />
              ) : displayedPreview.url && displayedPreview.kind === 'audio' ? (
                <audio src={displayedPreview.url} controls />
              ) : null}
            </div>
          </>
        ) : null}
      </RecordOverlay>

      {deletingForOwner ? (
        <div className="record-media__confirm" role="alert">
          <p>
            {t('record.media.deleteConfirm', {
              fileName: deletingForOwner.fileName,
            })}
          </p>
          <div>
            <button
              ref={cancelDeleteButton}
              type="button"
              className="button button--secondary"
              onClick={() => {
                setDeleting(null)
                deleteReturnFocus.current?.focus()
              }}
            >
              {t('record.media.cancelDelete')}
            </button>
            <button
              type="button"
              className="button button--destructive"
              onClick={async () => {
                if (await media.deleteItem(deletingForOwner)) {
                  setDeleting(null)
                  addButton.current?.focus()
                }
              }}
            >
              {t('record.media.confirmDelete')}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  )
}

function RecordMediaCard({
  client,
  item,
  metadata,
  previewLabel,
  deleteLabel,
  onPreview,
  onDelete,
}: {
  readonly client: LifeArchiveClient
  readonly item: MediaItem
  readonly metadata: string
  readonly previewLabel: string
  readonly deleteLabel: string
  readonly onPreview: (opener: HTMLButtonElement) => void
  readonly onDelete: (opener: HTMLButtonElement) => void
}) {
  const imageUrl = useInlineImage(client, item)
  const [imageFailed, setImageFailed] = useState(false)
  return (
    <li className="record-media__card">
      <button
        type="button"
        className="record-media__preview-action"
        aria-label={previewLabel}
        onClick={(event) => onPreview(event.currentTarget)}
      >
        <span className="record-media__visual">
          {imageUrl && !imageFailed ? (
            <img
              className="record-media__thumbnail"
              src={imageUrl}
              alt=""
              onError={() => setImageFailed(true)}
            />
          ) : (
            <MediaGlyph item={item} />
          )}
        </span>
        <span className="record-media__metadata">
          <strong>{item.fileName}</strong>
          <span className="meta-text">{metadata}</span>
        </span>
      </button>
      <button
        type="button"
        className="record-media__delete"
        aria-label={deleteLabel}
        onClick={(event) => onDelete(event.currentTarget)}
      >
        <RecordControlIcon name="close" />
      </button>
    </li>
  )
}

function useInlineImage(
  client: LifeArchiveClient,
  item: MediaItem,
): string | null {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    let objectUrl: string | null = null
    if (item.kind !== 'image' || safePreviewKind(item.mimeType) !== 'image') {
      return () => {
        active = false
      }
    }

    void client.media.content({ mediaId: item.id }).then((result) => {
      if (
        !active ||
        result.status === 'failed' ||
        result.value.mediaId !== item.id ||
        result.value.byteSize !== result.value.bytes.byteLength
      ) {
        return
      }
      const copy = new Uint8Array(result.value.bytes)
      objectUrl = URL.createObjectURL(
        new Blob([copy.buffer], { type: item.mimeType }),
      )
      setUrl(objectUrl)
    })

    return () => {
      active = false
      if (objectUrl !== null) URL.revokeObjectURL(objectUrl)
    }
  }, [client, item.id, item.kind, item.mimeType])
  return url
}

function MediaGlyph({ item }: { readonly item: MediaItem }) {
  return (
    <span className="record-media__glyph" aria-hidden="true">
      {item.kind === 'image'
        ? '▧'
        : item.kind === 'video'
          ? '▷'
          : item.kind === 'audio'
            ? '♪'
            : item.kind === 'document' || item.kind === 'text'
              ? '≡'
              : '·'}
    </span>
  )
}
