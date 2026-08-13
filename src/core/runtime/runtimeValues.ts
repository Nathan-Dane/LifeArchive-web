import {
  civilDate,
  isCivilDate,
  isRevision,
  isStableId,
  revision,
  stableId,
  type InvalidationToken,
  type MediaKind,
  type PrivacyLevel,
  type StableId,
} from '../client'

export function mapInvalidation(value: unknown): InvalidationToken {
  const token = record(value, 'runtime invalidation token')
  return {
    storeInstanceId: string(
      token.storeInstanceId,
      'invalidation store instance identifier',
    ),
    revision: requiredRevision(token.revision, 'invalidation revision'),
  }
}

export function mapInvalidationRequest(value: InvalidationToken) {
  return {
    storeInstanceId: string(
      value.storeInstanceId,
      'invalidation store instance identifier',
    ),
    revision: requiredRevision(value.revision, 'invalidation revision'),
  }
}

export function mediaKind(value: unknown): MediaKind {
  return literal(
    value,
    ['image', 'video', 'audio', 'document', 'text', 'other'] as const,
    'media kind',
  )
}

export function privacy(value: unknown): PrivacyLevel {
  return literal(
    value,
    ['normal', 'sensitive', 'locked'] as const,
    'privacy level',
  )
}

export function record(
  value: unknown,
  description: string,
): Record<string, unknown> {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value) ||
    value instanceof ArrayBuffer
  ) {
    throw new TypeError(`Malformed ${description}`)
  }
  return value as Record<string, unknown>
}

export function array(value: unknown, description: string): readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new TypeError(`Malformed ${description}`)
  }
  return value
}

export function string(value: unknown, description: string): string {
  if (typeof value !== 'string') {
    throw new TypeError(`Malformed ${description}`)
  }
  return value
}

export function boolean(value: unknown, description: string): boolean {
  if (typeof value !== 'boolean') {
    throw new TypeError(`Malformed ${description}`)
  }
  return value
}

export function integer(value: unknown, description: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    throw new TypeError(`Malformed ${description}`)
  }
  return value
}

export function count(value: unknown, description: string): number {
  const result = integer(value, description)
  if (result < 0) {
    throw new TypeError(`Malformed ${description}`)
  }
  return result
}

export function nullableInteger(
  value: unknown,
  description: string,
): number | null {
  return value === null || value === undefined
    ? null
    : integer(value, description)
}

export function timestampMillis(value: unknown, description: string): number {
  const timestamp = string(value, description)
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/.test(timestamp)) {
    throw new TypeError(`Malformed ${description}`)
  }
  const milliseconds = Date.parse(timestamp)
  if (!Number.isSafeInteger(milliseconds)) {
    throw new TypeError(`Malformed ${description}`)
  }
  return milliseconds
}

export function nullableCount(
  value: unknown,
  description: string,
): number | null {
  return value === null || value === undefined
    ? null
    : count(value, description)
}

export function nullableWeekNumber(value: unknown): number | null {
  const number = nullableCount(value, 'time window week number')
  if (number !== null && (number < 1 || number > 53)) {
    throw new TypeError('Malformed time window week number')
  }
  return number
}

export function nullableString(
  value: unknown,
  description: string,
): string | null {
  return value === null || value === undefined
    ? null
    : string(value, description)
}

export function requiredStableId(
  value: unknown,
  description: string,
): StableId {
  if (typeof value !== 'string' || !isStableId(value)) {
    throw new TypeError(`Malformed ${description}`)
  }
  return stableId(value)
}

export function nullableStableId(
  value: unknown,
  description: string,
): StableId | null {
  return value === null || value === undefined
    ? null
    : requiredStableId(value, description)
}

export function requiredRevision(value: unknown, description: string) {
  if (typeof value !== 'string' || !isRevision(value)) {
    throw new TypeError(`Malformed ${description}`)
  }
  return revision(value)
}

export function requiredCivilDate(value: unknown, description: string) {
  if (typeof value !== 'string' || !isCivilDate(value)) {
    throw new TypeError(`Malformed ${description}`)
  }
  return civilDate(value)
}

export function nullableCivilDate(value: unknown, description: string) {
  return value === null || value === undefined
    ? null
    : requiredCivilDate(value, description)
}

export function literal<const Values extends readonly string[]>(
  value: unknown,
  values: Values,
  description: string,
): Values[number] {
  if (typeof value !== 'string' || !values.includes(value)) {
    throw new TypeError(`Malformed ${description}`)
  }
  return value as Values[number]
}

export function stableIds(
  value: unknown,
  description: string,
): readonly StableId[] {
  return array(value, description).map((entry) =>
    requiredStableId(entry, description),
  )
}

export function stableStrings(
  value: unknown,
  description: string,
): readonly string[] {
  return array(value, description).map((entry) => string(entry, description))
}

export function integerText(value: unknown, description: string): string {
  return String(count(value, description))
}

export function decimalCount(value: unknown, description: string): number {
  const text = string(value, description)
  if (!/^(0|[1-9][0-9]*)$/.test(text)) {
    throw new TypeError(`Malformed ${description}`)
  }
  const parsed = Number(text)
  if (!Number.isSafeInteger(parsed)) {
    throw new TypeError(`Malformed ${description}`)
  }
  return parsed
}
