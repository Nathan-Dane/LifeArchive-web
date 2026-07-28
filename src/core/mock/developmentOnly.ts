/**
 * The build-mode guard that keeps the development mock out of production.
 *
 * There are two independent protections and both are deliberate:
 *
 * 1. **Static elimination.** `selectClient.ts` reaches the mock only through a
 *    dynamic import inside a branch that is statically false in a production
 *    build, so the bundler drops the module entirely. `scripts/check-mock-
 *    excluded.mjs` greps the built output for {@link DEVELOPMENT_MOCK_MARKER}
 *    and fails the build if any of it survived.
 * 2. **Runtime refusal.** If the module were reached anyway, constructing the
 *    mock throws. A production build must fail loudly rather than answer with
 *    values that are not durable.
 *
 * The mock is never an automatic fallback. A missing or incompatible runtime in
 * production is an explicit unavailable state, not a reason to substitute
 * fixtures.
 */

/**
 * A token that exists nowhere except the development mock. It is the string the
 * bundle check greps for, so it must stay a plain literal — never assembled at
 * runtime, and never reused for user-facing copy.
 */
export const DEVELOPMENT_MOCK_MARKER = 'lifearchive:development-mock:v1'

/** The build facts the selector and the mock are allowed to read. */
export interface BuildMode {
  readonly DEV: boolean
  readonly PROD: boolean
  /** The explicit opt-in. Absence means the mock is not selected. */
  readonly clientSelection: string | null
}

/** The two explicit development selections. Absence selects the hosted pin. */
export const DEVELOPMENT_MOCK_SELECTION = 'development-mock'
export const LOCAL_RUNTIME_SELECTION = 'local-runtime'

/** Reads the current build's facts. The only place `import.meta.env` is read. */
export function currentBuildMode(): BuildMode {
  return {
    DEV: import.meta.env.DEV,
    PROD: import.meta.env.PROD,
    clientSelection: import.meta.env.VITE_LIFEARCHIVE_CLIENT ?? null,
  }
}

/** Thrown when the development mock is reached outside a development build. */
export class ProductionMockError extends Error {
  constructor() {
    super('The development mock cannot be used in a production build')
    this.name = 'ProductionMockError'
  }
}

/** True only for a development build that explicitly asked for the mock. */
export function isDevelopmentMockSelected(mode: BuildMode): boolean {
  return (
    mode.DEV &&
    !mode.PROD &&
    mode.clientSelection === DEVELOPMENT_MOCK_SELECTION
  )
}

/** True only for a development build that explicitly asked for local bytes. */
export function isLocalRuntimeSelected(mode: BuildMode): boolean {
  return (
    mode.DEV && !mode.PROD && mode.clientSelection === LOCAL_RUNTIME_SELECTION
  )
}

/** Refuses to continue unless this is a development build. */
export function assertDevelopmentBuild(mode: BuildMode): void {
  if (!mode.DEV || mode.PROD) {
    throw new ProductionMockError()
  }
}
