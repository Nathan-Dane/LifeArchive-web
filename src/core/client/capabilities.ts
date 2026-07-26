/**
 * The frozen shape of the feature-facing client surface.
 *
 * This is the public inventory of what feature code may ask for, grouped by
 * area. It is not the runtime capability inventory: capability names, versions,
 * and negotiation belong to the runtime metadata beneath this module, and this
 * list deliberately does not restate them.
 *
 * Two things are enforced against this inventory:
 *
 * - every declared method exists on `LifeArchiveClient`, and every method on
 *   `LifeArchiveClient` is declared here, so the surface cannot grow quietly;
 * - none of the excluded areas appear at all.
 */

/** Every area and method feature code may use, in stable order. */
export const CLIENT_SURFACE = {
  runtime: ['status', 'observeStatus', 'storage'],
  archive: [
    'session',
    'observeSession',
    'create',
    'open',
    'close',
    'overview',
    'verify',
    'import',
    'export',
    'erase',
  ],
  identity: ['load', 'save'],
  time: ['window', 'step', 'calendarContext'],
  record: ['load', 'save', 'delete', 'listObjects'],
  structured: ['load', 'create', 'save', 'delete', 'convertSpanToEvent'],
  tracks: [
    'list',
    'load',
    'create',
    'save',
    'delete',
    'createWithFirstMember',
    'history',
    'attachMember',
    'detachMember',
    'createMember',
  ],
  timeline: ['index', 'focus', 'structuredDetail', 'structuredList'],
  media: ['list', 'content', 'import', 'delete'],
  operations: [
    'newStableId',
    'newOperationId',
    'requestCancel',
    'observeChanges',
  ],
} as const

export type ClientSurfaceArea = keyof typeof CLIENT_SURFACE

export type ClientSurfaceMethod<Area extends ClientSurfaceArea> =
  (typeof CLIENT_SURFACE)[Area][number]

/**
 * Areas v0.1 does not expose through this client at all. Their absence is a
 * product decision, not an unimplemented gap, and nothing is emulated in
 * TypeScript to stand in for them.
 */
export const EXCLUDED_SURFACE_AREAS = [
  'accounts',
  'ai',
  'analytics',
  'raw',
  'search',
  'store',
  'sync',
  'telemetry',
] as const

export type ExcludedSurfaceArea = (typeof EXCLUDED_SURFACE_AREAS)[number]

/**
 * Whether the client is speaking to something that negotiated the entire
 * approved surface. There is no partial state: an incomplete surface makes the
 * runtime incompatible rather than partly usable.
 */
export type ClientSurfaceState = 'complete' | 'incomplete'

/** The whole surface as sorted `area.method` paths. */
export function describeClientSurface(): readonly string[] {
  return Object.entries(CLIENT_SURFACE)
    .flatMap(([area, methods]) => methods.map((method) => `${area}.${method}`))
    .sort()
}
