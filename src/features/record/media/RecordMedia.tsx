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
import { RecordControlIcon } from '../overlays'
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
  const cancelDeleteButton = useRef<HTMLButtonElement>(null)
  const deleteReturnFocus = useRef<HTMLButtonElement | null>(null)
  const [deleting, setDeleting] = useState<MediaItem | null>(null)
  const media = useRecordMedia(client, { ownerId, onParentRevision })
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
            <li key={item.id} className="record-media__card">
              <button
                type="button"
                className="record-media__preview-action"
                aria-label={t('record.media.previewAction', {
                  fileName: item.fileName,
                })}
                onClick={() => void media.previewItem(item)}
              >
                <MediaGlyph item={item} />
                <span className="record-media__metadata">
                  <strong>{item.fileName}</strong>
                  <span className="meta-text">
                    {t('record.media.itemMetadata', {
                      kind: t(`record.media.kind.${item.kind}`),
                      size: format.byteSize(item.byteSize),
                    })}
                  </span>
                </span>
              </button>
              <button
                type="button"
                className="record-media__delete"
                aria-label={t('record.media.deleteAction', {
                  fileName: item.fileName,
                })}
                onClick={(event) => {
                  deleteReturnFocus.current = event.currentTarget
                  setDeleting(item)
                }}
              >
                <RecordControlIcon name="close" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {media.preview ? (
        <div
          className="record-media__preview"
          role="region"
          aria-labelledby={previewHeadingId}
        >
          <header>
            <div>
              <h3 id={previewHeadingId}>{media.preview.item.fileName}</h3>
              <p className="meta-text">
                {t('record.media.previewMetadata', {
                  mimeType: media.preview.item.mimeType,
                  size: format.byteSize(media.preview.item.byteSize),
                })}
              </p>
            </div>
            <button
              type="button"
              className="button button--secondary"
              onClick={media.closePreview}
            >
              {t('record.media.closePreview')}
            </button>
          </header>
          {media.preview.status === 'loading' ? (
            <p role="status">{t('record.media.previewLoading')}</p>
          ) : media.preview.status === 'failed' && media.preview.failure ? (
            <p role="alert">
              {t('record.media.previewFailed', {
                detail: failureMessage(localisation, media.preview.failure),
              })}
            </p>
          ) : media.preview.status === 'unsupported' ? (
            <p>{t('record.media.previewUnsupported')}</p>
          ) : media.preview.url && media.preview.kind === 'image' ? (
            <img
              src={media.preview.url}
              alt={t('record.media.previewAlt', {
                fileName: media.preview.item.fileName,
              })}
            />
          ) : media.preview.url && media.preview.kind === 'video' ? (
            <video src={media.preview.url} controls />
          ) : media.preview.url && media.preview.kind === 'audio' ? (
            <audio src={media.preview.url} controls />
          ) : null}
        </div>
      ) : null}

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
