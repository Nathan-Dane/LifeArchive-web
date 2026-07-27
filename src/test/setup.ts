import '@testing-library/jest-dom/vitest'
import { beforeEach } from 'vitest'
import { installClientMedia, resetClientMedia } from './clientMedia'

class TestStorage implements Storage {
  readonly #values = new Map<string, string>()

  get length(): number {
    return this.#values.size
  }

  clear(): void {
    for (const key of this.#values.keys()) Reflect.deleteProperty(this, key)
    this.#values.clear()
  }

  getItem(key: string): string | null {
    return this.#values.get(key) ?? null
  }

  key(index: number): string | null {
    return [...this.#values.keys()][index] ?? null
  }

  removeItem(key: string): void {
    this.#values.delete(key)
    Reflect.deleteProperty(this, key)
  }

  setItem(key: string, value: string): void {
    this.#values.set(key, String(value))
    Object.defineProperty(this, key, {
      configurable: true,
      enumerable: true,
      value: String(value),
      writable: true,
    })
  }
}
const testStorage = new TestStorage()

/*
 * Node 26 exposes an unavailable experimental `localStorage` on the test
 * global. Use a deterministic in-memory browser implementation instead.
 */
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: testStorage,
})

installClientMedia()
beforeEach(resetClientMedia)
