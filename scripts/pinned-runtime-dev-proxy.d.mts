export interface PinnedRuntimeProxyEntry {
  readonly target: string
  readonly changeOrigin: true
  readonly secure: true
}

export function pinnedRuntimeDevProxy(
  runtimeLock: unknown,
): Readonly<Record<string, PinnedRuntimeProxyEntry>>
