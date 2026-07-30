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

/*
 * jsdom omits geometry and drag primitives that Lexical's DOM selection and
 * clipboard handlers probe. Layout is immaterial to component tests.
 */
Range.prototype.getClientRects = () => [] as unknown as DOMRectList
Range.prototype.getBoundingClientRect = () => new DOMRect()
if (typeof globalThis.DragEvent === 'undefined') {
  Object.defineProperty(globalThis, 'DragEvent', {
    configurable: true,
    value: class TestDragEvent extends MouseEvent {
      readonly dataTransfer = null
    },
  })
}
if (typeof globalThis.ClipboardEvent === 'undefined') {
  Object.defineProperty(globalThis, 'ClipboardEvent', {
    configurable: true,
    value: class TestClipboardEvent extends Event {
      readonly clipboardData = null
    },
  })
}
