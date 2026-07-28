import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  ClientFailure,
  LifeArchiveClient,
  MediaItem,
  Revision,
  StableId,
} from '../../../core/client'
import { acquireMediaFile } from '../../../platform/files/mediaAcquisition'
import {
  PreviewUrlManager,
  safePreviewKind,
  type SafePreviewKind,
} from './previewUrlManager'

interface MediaListingView {
  readonly ownerId: StableId | null
  readonly revision: Revision | null
  readonly items: readonly MediaItem[]
  readonly status: 'unavailable' | 'loading' | 'ready' | 'failed'
  readonly failure: ClientFailure | null
}

export interface MediaProgress {
  readonly ownerId: StableId
  readonly fileName: string
  readonly phase: 'reading' | 'importing'
  readonly bytesRead: number
  readonly byteSize: number
}

export interface MediaPreview {
  readonly item: MediaItem
  readonly kind: SafePreviewKind | null
  readonly url: string | null
  readonly status: 'loading' | 'ready' | 'failed' | 'unsupported'
  readonly failure: ClientFailure | null
}

export type MediaMutationNotice =
  'imported' | 'deleted' | 'acquisitionFailed' | null

export interface RecordMedia {
  readonly listing: MediaListingView
  readonly progress: MediaProgress | null
  readonly preview: MediaPreview | null
  readonly mutationFailure: ClientFailure | null
  readonly notice: MediaMutationNotice
  readonly importFiles: (files: readonly File[]) => Promise<void>
  readonly previewItem: (item: MediaItem) => Promise<void>
  readonly closePreview: () => void
  readonly deleteItem: (item: MediaItem) => Promise<boolean>
  readonly retry: () => void
}

interface RecordMediaOptions {
  readonly ownerId: StableId | null
  readonly onParentRevision?: (revision: Revision) => void
}

const EMPTY: MediaListingView = {
  ownerId: null,
  revision: null,
  items: [],
  status: 'unavailable',
  failure: null,
}

export function useRecordMedia(
  client: LifeArchiveClient,
  { ownerId, onParentRevision }: RecordMediaOptions,
): RecordMedia {
  const generation = useRef(0)
  const previewUrls = useRef(new PreviewUrlManager())
  const [retryGeneration, setRetryGeneration] = useState(0)
  const [listing, setListing] = useState<MediaListingView>(EMPTY)
  const [progress, setProgress] = useState<MediaProgress | null>(null)
  const [preview, setPreview] = useState<MediaPreview | null>(null)
  const [mutationFailure, setMutationFailure] = useState<ClientFailure | null>(
    null,
  )
  const [notice, setNotice] = useState<MediaMutationNotice>(null)

  const publishListing = useCallback(
    (
      capturedOwner: StableId,
      capturedGeneration: number,
      adoptRevision: boolean,
      value: Awaited<ReturnType<LifeArchiveClient['media']['list']>>,
    ): Revision | null => {
      if (capturedGeneration !== generation.current) {
        return value.status === 'ok' ? value.value.parentRevision : null
      }
      if (value.status === 'failed') {
        setListing({
          ownerId: capturedOwner,
          revision: null,
          items: [],
          status: 'failed',
          failure: value.failure,
        })
        return null
      }
      setListing({
        ownerId: capturedOwner,
        revision: value.value.parentRevision,
        items: value.value.items,
        status: 'ready',
        failure: null,
      })
      if (adoptRevision) onParentRevision?.(value.value.parentRevision)
      return value.value.parentRevision
    },
    [onParentRevision],
  )

  const readListing = useCallback(
    async (
      capturedOwner: StableId,
      capturedGeneration: number,
      adoptRevision = false,
    ): Promise<Revision | null> => {
      const result = await client.media.list({
        parentEntryId: capturedOwner,
      })
      return publishListing(
        capturedOwner,
        capturedGeneration,
        adoptRevision,
        result,
      )
    },
    [client, publishListing],
  )

  useEffect(() => {
    const capturedGeneration = (generation.current += 1)
    previewUrls.current.close()
    void Promise.resolve().then(() => {
      if (capturedGeneration !== generation.current) return
      setPreview(null)
      setProgress(null)
      setMutationFailure(null)
      setNotice(null)
      if (ownerId === null) {
        setListing(EMPTY)
        return
      }
      setListing({
        ownerId,
        revision: null,
        items: [],
        status: 'loading',
        failure: null,
      })
      void readListing(ownerId, capturedGeneration)
    })
  }, [ownerId, readListing, retryGeneration])

  useEffect(
    () => () => {
      generation.current += 1
      previewUrls.current.close()
    },
    [],
  )

  const importFiles = useCallback(
    async (files: readonly File[]) => {
      const capturedOwner = ownerId
      const capturedGeneration = generation.current
      let parentRevision =
        listing.ownerId === capturedOwner ? listing.revision : null
      if (capturedOwner === null || parentRevision === null || files.length < 1)
        return

      setMutationFailure(null)
      setNotice(null)
      for (const file of files) {
        let acquired: Awaited<ReturnType<typeof acquireMediaFile>>
        try {
          acquired = await acquireMediaFile(file, Date.now(), (current) => {
            if (generation.current === capturedGeneration) {
              setProgress({
                ownerId: capturedOwner,
                fileName: file.name,
                phase: 'reading',
                ...current,
              })
            }
          })
        } catch {
          if (generation.current === capturedGeneration) {
            setProgress(null)
            setNotice('acquisitionFailed')
          }
          return
        }

        if (generation.current === capturedGeneration) {
          setProgress({
            ownerId: capturedOwner,
            fileName: acquired.fileName,
            phase: 'importing',
            bytesRead: acquired.bytes.byteLength,
            byteSize: acquired.bytes.byteLength,
          })
        }

        const result = await client.media.import({
          newMediaId: client.operations.newStableId(),
          parentEntryId: capturedOwner,
          expectedParentRevision: parentRevision,
          fileName: acquired.fileName,
          bytes: acquired.bytes,
          createdAtMs: acquired.createdAtMs,
          mimeTypeHint: acquired.mimeTypeHint,
          kindHint: acquired.kindHint,
        })

        if (result.status === 'failed') {
          if (generation.current === capturedGeneration) {
            setProgress(null)
            setMutationFailure(result.failure)
          }
          return
        }

        parentRevision = await readListing(
          capturedOwner,
          capturedGeneration,
          true,
        )
        if (parentRevision === null) {
          if (generation.current === capturedGeneration) {
            setProgress(null)
          }
          return
        }
      }

      if (generation.current === capturedGeneration) {
        setProgress(null)
        setNotice('imported')
      }
    },
    [client, listing, ownerId, readListing],
  )

  const closePreview = useCallback(() => {
    previewUrls.current.close()
    setPreview(null)
  }, [])

  const previewItem = useCallback(
    async (item: MediaItem) => {
      const kind = safePreviewKind(item.mimeType)
      closePreview()
      if (kind === null) {
        setPreview({
          item,
          kind,
          url: null,
          status: 'unsupported',
          failure: null,
        })
        return
      }
      const capturedGeneration = generation.current
      setPreview({
        item,
        kind,
        url: null,
        status: 'loading',
        failure: null,
      })
      const result = await client.media.content({ mediaId: item.id })
      if (capturedGeneration !== generation.current) {
        return
      }
      if (result.status === 'failed') {
        setPreview({
          item,
          kind,
          url: null,
          status: 'failed',
          failure: result.failure,
        })
        return
      }
      if (
        result.value.mediaId !== item.id ||
        result.value.byteSize !== result.value.bytes.byteLength
      ) {
        setPreview({
          item,
          kind,
          url: null,
          status: 'unsupported',
          failure: null,
        })
        return
      }
      setPreview({
        item,
        kind,
        url: previewUrls.current.open(item.mimeType, result.value.bytes),
        status: 'ready',
        failure: null,
      })
    },
    [client, closePreview],
  )

  const deleteItem = useCallback(
    async (item: MediaItem): Promise<boolean> => {
      const capturedOwner = ownerId
      const capturedGeneration = generation.current
      const parentRevision =
        listing.ownerId === capturedOwner ? listing.revision : null
      if (
        capturedOwner === null ||
        parentRevision === null ||
        item.parentEntryId !== capturedOwner
      ) {
        return false
      }
      setMutationFailure(null)
      setNotice(null)
      const result = await client.media.delete({
        mediaId: item.id,
        parentEntryId: capturedOwner,
        expectedParentRevision: parentRevision,
      })
      if (result.status === 'failed') {
        if (generation.current === capturedGeneration) {
          setMutationFailure(result.failure)
        }
        return false
      }
      const refreshedRevision = await readListing(
        capturedOwner,
        capturedGeneration,
        true,
      )
      const current = generation.current === capturedGeneration
      if (current && refreshedRevision !== null) {
        if (preview?.item.id === item.id) closePreview()
        setNotice('deleted')
      }
      return refreshedRevision !== null
    },
    [client, closePreview, listing, ownerId, preview, readListing],
  )

  return {
    listing,
    progress,
    preview,
    mutationFailure,
    notice,
    importFiles,
    previewItem,
    closePreview,
    deleteItem,
    retry: () => setRetryGeneration((value) => value + 1),
  }
}
