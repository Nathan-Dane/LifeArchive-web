/**
 * The banner that must stay on screen for as long as the development mock is
 * the selected client.
 *
 * It is not a toast and not dismissible. The whole point of the mock is that
 * what it shows is not real, and a notice the user can lose is a notice that
 * will be lost exactly when it matters.
 *
 * The composed application now passes localised copy through the `notice`
 * prop, from `development.mock.notice` in the English catalog. The constant
 * below stays as this component's own default so the mock remains readable in
 * isolation, and `i18n/messages.test.ts` holds the two to the same sentence so
 * they cannot drift apart.
 */

/**
 * The wording, held in one place. It states the mode and the absence of
 * durability, and it makes no claim about saving, storing, syncing, or backing
 * anything up — because none of that is happening.
 */
export const DEVELOPMENT_MOCK_NOTICE =
  'Development mock — not durable. Every value on screen is a fixed example, and nothing you type here is kept.'

export interface DevelopmentMockBannerProps {
  /** Localised replacement copy. Defaults to {@link DEVELOPMENT_MOCK_NOTICE}. */
  readonly notice?: string
}

export function DevelopmentMockBanner({
  notice = DEVELOPMENT_MOCK_NOTICE,
}: DevelopmentMockBannerProps) {
  return (
    <aside className="development-mock-banner" role="status">
      {notice}
    </aside>
  )
}
