/**
 * The banner that must stay on screen for as long as the development mock is
 * the selected client.
 *
 * It is not a toast and not dismissible. The whole point of the mock is that
 * what it shows is not real, and a notice the user can lose is a notice that
 * will be lost exactly when it matters.
 *
 * The composed application passes localised copy through the `notice` prop
 * from the message catalog.
 */

export interface DevelopmentMockBannerProps {
  readonly notice: string
}

export function DevelopmentMockBanner({ notice }: DevelopmentMockBannerProps) {
  return (
    <aside className="development-mock-banner" role="status">
      {notice}
    </aside>
  )
}
