import webRuntimePolicy from '../../../../runtime/web-runtime-policy.json'

/** The reviewed browser ABI inventory. Nothing else may cross the worker. */
const APPROVED_RUNTIME_OPERATIONS = new Set<string>(
  webRuntimePolicy.capabilities.map(({ name }) => name),
)

export function isApprovedRuntimeOperation(
  operation: unknown,
): operation is string {
  return (
    typeof operation === 'string' && APPROVED_RUNTIME_OPERATIONS.has(operation)
  )
}

export function approvedRuntimeOperations(): readonly string[] {
  return [...APPROVED_RUNTIME_OPERATIONS]
}
