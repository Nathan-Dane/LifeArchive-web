import { useNavigate } from 'react-router-dom'
import { LiveStatus } from '../../../accessibility'
import type {
  LifeArchiveClient,
  PersistenceGrant,
  StorageDurability,
} from '../../../core/client'
import {
  failureMessage,
  useFormat,
  useLocalisation,
  type AppLocalisation,
} from '../../../i18n'
import type { StoragePersistence } from '../../../platform/storage'
import {
  useFirstRun,
  type FirstRunPhase,
  type FirstRunState,
} from './firstRunController'

export interface FirstRunPageProps {
  readonly client: LifeArchiveClient
  /** Injected in tests; production uses the browser adapter. */
  readonly persistence?: StoragePersistence
}

const DURABILITY_MESSAGES = {
  durable: 'archive.firstRun.durability.durable',
  'best-effort': 'archive.firstRun.durability.bestEffort',
  unproven: 'archive.firstRun.durability.unproven',
} as const satisfies Record<StorageDurability, string>

/**
 * One sentence per browser answer worth explaining. A granted request never
 * reaches this screen: it goes straight on to creating the archive.
 */
const LIMITED_STORAGE_MESSAGES = {
  denied: 'archive.firstRun.storage.denied',
  unknown: 'archive.firstRun.storage.unknown',
  unsupported: 'archive.firstRun.storage.unsupported',
} as const satisfies Record<Exclude<PersistenceGrant, 'granted'>, string>

function limitedStorageMessage(grant: PersistenceGrant | null) {
  return grant && grant !== 'granted'
    ? LIMITED_STORAGE_MESSAGES[grant]
    : LIMITED_STORAGE_MESSAGES.unknown
}

/**
 * What a waiting phase announces, and the heading it shows while it waits.
 * Only the waiting phases announce: a screen the reader is looking at does not
 * also need reading out.
 */
const WAITING_MESSAGES = {
  'requesting-storage': 'archive.firstRun.status.requestingStorage',
  creating: 'archive.firstRun.status.creating',
  created: 'archive.firstRun.status.opening',
} as const

function waitingMessage(phase: FirstRunPhase) {
  return phase in WAITING_MESSAGES
    ? WAITING_MESSAGES[phase as keyof typeof WAITING_MESSAGES]
    : null
}

/**
 * First run.
 *
 * The screen says what a browser-local archive means before offering to create
 * one, and every storage sentence on it comes from the runtime's own report or
 * the browser's own answer — never from a constant. Record is reached only
 * once the runtime has confirmed the archive, so nothing here presents a store
 * that recovery, migration, and integrity have not finished with.
 */
export function FirstRunPage({ client, persistence }: FirstRunPageProps) {
  const navigate = useNavigate()
  const localisation = useLocalisation()
  const t = localisation.t
  const format = useFormat()
  const { state, begin, createAnyway, retry } = useFirstRun({
    client,
    persistence,
    onCreated: () => navigate('/record', { replace: true }),
  })

  const waiting = waitingMessage(state.phase)

  return (
    <main id="main-content" className="workspace__content" tabIndex={-1}>
      <section
        className="first-run"
        aria-labelledby="first-run-title"
        aria-busy={waiting !== null || undefined}
      >
        {waiting !== null ? <Title>{t(waiting)}</Title> : null}

        {state.phase === 'offering' ? (
          <>
            <Title>{t('archive.firstRun.title')}</Title>
            <p className="first-run__detail">{t('archive.firstRun.intro')}</p>
            <p className="first-run__detail">{t('archive.firstRun.copies')}</p>
            <ul className="first-run__facts">
              {state.durability ? (
                <li>{t(DURABILITY_MESSAGES[state.durability])}</li>
              ) : null}
              {state.estimate ? (
                <li>
                  {t('archive.firstRun.estimate', {
                    quota: format.byteSize(state.estimate.quotaBytes),
                    used: format.byteSize(state.estimate.usedBytes),
                  })}
                </li>
              ) : null}
            </ul>
            <div className="first-run__actions">
              <button
                type="button"
                className="button button--primary"
                onClick={begin}
              >
                {t('archive.firstRun.action.create')}
              </button>
            </div>
          </>
        ) : null}

        {state.phase === 'storage-limited' ? (
          <>
            <Title>{t('archive.firstRun.storage.title')}</Title>
            <p className="first-run__detail">
              {t(limitedStorageMessage(state.grant))}{' '}
              {t('archive.firstRun.storage.consequence')}
            </p>
            <p className="first-run__detail">
              {t('archive.firstRun.storage.advice')}
            </p>
            <div className="first-run__actions">
              <button
                type="button"
                className="button button--primary"
                onClick={createAnyway}
              >
                {t('archive.firstRun.action.createAnyway')}
              </button>
              <button type="button" className="button" onClick={begin}>
                {t('archive.firstRun.action.askAgain')}
              </button>
            </div>
          </>
        ) : null}

        {state.phase === 'locked' ? (
          <>
            <Title>{t('archive.firstRun.locked.title')}</Title>
            <p className="first-run__detail">
              {t('archive.firstRun.locked.detail')}
            </p>
            <RetryAction label={t('app.action.retry')} onRetry={retry} />
          </>
        ) : null}

        {state.phase === 'failed' ? (
          <>
            <Title>{t('archive.firstRun.failed.title')}</Title>
            <p className="first-run__detail">
              {failureSentence(localisation, state)}
            </p>
            <p className="first-run__detail">
              {t('archive.firstRun.failed.detail')}
            </p>
            <RetryAction label={t('app.action.retry')} onRetry={retry} />
          </>
        ) : null}

        <LiveStatus>{waiting !== null ? t(waiting) : ''}</LiveStatus>
      </section>
    </main>
  )
}

function failureSentence(
  localisation: AppLocalisation,
  state: FirstRunState,
): string {
  return state.failure
    ? failureMessage(localisation, state.failure)
    : localisation.t('failure.generic')
}

function Title({ children }: { readonly children: string }) {
  return (
    <h1 id="first-run-title" className="display-large">
      {children}
    </h1>
  )
}

function RetryAction({
  label,
  onRetry,
}: {
  readonly label: string
  readonly onRetry: () => void
}) {
  return (
    <div className="first-run__actions">
      <button
        type="button"
        className="button button--primary"
        onClick={onRetry}
      >
        {label}
      </button>
    </div>
  )
}
