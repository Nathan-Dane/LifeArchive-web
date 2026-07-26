/**
 * Development-mode copy.
 *
 * The mock's own banner keeps a self-contained default so the mock stays
 * readable in isolation; this is the wording the composed application shows,
 * and `messages.test.ts` holds the two to the same sentence so they cannot
 * drift apart.
 */
export const developmentMessages = {
  'development.mock.notice':
    'Development mock — not durable. Every value on screen is a fixed example, and nothing you type here is kept.',
} as const
