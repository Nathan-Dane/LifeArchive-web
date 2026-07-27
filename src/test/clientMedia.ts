const matches = new Set<string>()
const listeners = new Map<string, Set<EventListenerOrEventListenerObject>>()

function mediaQueryList(query: string): MediaQueryList {
  return {
    media: query,
    matches: matches.has(query),
    onchange: null,
    addEventListener: (
      _type: string,
      listener: EventListenerOrEventListenerObject | null,
    ) => {
      if (!listener) return
      const queryListeners = listeners.get(query) ?? new Set()
      queryListeners.add(listener)
      listeners.set(query, queryListeners)
    },
    removeEventListener: (
      _type: string,
      listener: EventListenerOrEventListenerObject | null,
    ) => {
      if (!listener) return
      listeners.get(query)?.delete(listener)
    },
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => true,
  }
}

/** Installs the deterministic media client used by component tests. */
export function installClientMedia(): void {
  Object.defineProperty(globalThis, 'matchMedia', {
    configurable: true,
    value: (query: string) => mediaQueryList(query),
  })
}

/** Selects the media conditions a rendered client should match. */
export function setClientMedia(...queries: readonly string[]): void {
  const previous = new Set(matches)
  matches.clear()
  for (const query of queries) matches.add(query)
  for (const query of new Set([...previous, ...matches])) {
    if (previous.has(query) === matches.has(query)) continue
    const event = {
      matches: matches.has(query),
      media: query,
    } as MediaQueryListEvent
    for (const listener of listeners.get(query) ?? []) {
      if (typeof listener === 'function') listener(event)
      else listener.handleEvent(event)
    }
  }
}

export function resetClientMedia(): void {
  matches.clear()
  listeners.clear()
}
