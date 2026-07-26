/**
 * The development mock's call log.
 *
 * It exists so a screen under development can be checked for the one thing a
 * mock can honestly prove: that the feature asked the client for exactly what
 * it needed, once, with the values it was given. It records; it decides
 * nothing, and no client answer depends on it.
 */

/** Every `area.method` path a mock call can be recorded against. */
export type MockCallPath = string

export interface MockCall {
  readonly path: MockCallPath
  /** The exact request the caller passed, kept by reference, never copied. */
  readonly request: unknown
  /** A monotonic position in this recorder, starting at 1. */
  readonly sequence: number
}

export class MockCallRecorder {
  private readonly entries: MockCall[] = []

  record(path: MockCallPath, request: unknown): void {
    this.entries.push({
      path,
      request,
      sequence: this.entries.length + 1,
    })
  }

  /** Every recorded call, in call order. */
  all(): readonly MockCall[] {
    return [...this.entries]
  }

  /** Every recorded call to one path, in call order. */
  to(path: MockCallPath): readonly MockCall[] {
    return this.entries.filter((entry) => entry.path === path)
  }

  countOf(path: MockCallPath): number {
    return this.to(path).length
  }

  /** The distinct paths called, in call order of first use. */
  paths(): readonly MockCallPath[] {
    return [...new Set(this.entries.map((entry) => entry.path))]
  }

  clear(): void {
    this.entries.length = 0
  }
}
