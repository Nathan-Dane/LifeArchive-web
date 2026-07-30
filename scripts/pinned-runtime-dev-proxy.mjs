/**
 * Builds the one development proxy entry for the exact pinned runtime path.
 * The browser still verifies the whole artifact and every manifest payload.
 */
export function pinnedRuntimeDevProxy(runtimeLock) {
  if (runtimeLock?.status !== 'pinned') return {}
  if (typeof runtimeLock.artifactUrl !== 'string') {
    throw new Error('The pinned runtime artifact URL is missing')
  }

  const artifact = new URL(runtimeLock.artifactUrl)
  if (
    artifact.protocol !== 'https:' ||
    artifact.username ||
    artifact.password ||
    artifact.hash
  ) {
    throw new Error('The pinned runtime artifact URL is not proxy-safe')
  }

  return {
    [artifact.pathname]: {
      target: artifact.origin,
      changeOrigin: true,
      secure: true,
    },
  }
}
