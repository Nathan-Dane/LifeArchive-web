const DURABLE_MUTATION_OPERATIONS = new Set([
  'archive.apply',
  'archive.erase',
  'archive.identity.save',
  'media.delete',
  'media.import',
  'record.deleteEntry',
  'record.saveDraft',
  'store.close',
  'store.open',
  'structured.convertSpanToEvent',
  'structured.create',
  'structured.delete',
  'structured.save',
  'track.attachMember',
  'track.create',
  'track.createMember',
  'track.createWithFirstMember',
  'track.delete',
  'track.detachMember',
  'track.save',
])

export function mayMutateDurableState(operation: string): boolean {
  return DURABLE_MUTATION_OPERATIONS.has(operation)
}
