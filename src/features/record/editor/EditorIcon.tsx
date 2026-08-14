import {
  EDITOR_MATERIAL_GLYPHS,
  type EditorIconName,
} from './editorMaterialGlyphs'

export type { EditorIconName } from './editorMaterialGlyphs'

export function EditorIcon({ name }: { readonly name: EditorIconName }) {
  return (
    <span
      className="material-symbols-rounded record-editor__material-icon"
      aria-hidden="true"
    >
      {EDITOR_MATERIAL_GLYPHS[name]}
    </span>
  )
}
