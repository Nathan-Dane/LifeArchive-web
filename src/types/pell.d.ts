declare module 'pell' {
  export interface PellSettings {
    readonly element: HTMLDivElement
    readonly actions?: readonly unknown[]
    readonly defaultParagraphSeparator?: string
    readonly styleWithCSS?: boolean
    readonly classes?: Readonly<{
      actionbar?: string
      button?: string
      content?: string
      selected?: string
    }>
    readonly onChange: (html: string) => void
  }

  export interface PellElement extends HTMLDivElement {
    readonly content: HTMLDivElement
  }

  export function exec(
    command: string,
    value?: string | boolean | null,
  ): boolean
  export function init(settings: PellSettings): PellElement
}
