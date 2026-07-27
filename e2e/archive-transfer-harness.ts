import {
  ARCHIVE_TRANSPORT_MIME_TYPE,
  deliverArchiveDownload,
  selectArchiveTransport,
} from '../src/platform/files/archiveTransfer'

const input = requiredElement<HTMLInputElement>('archive-input')
const selectionResult = requiredElement<HTMLOutputElement>('selection-result')
const deliver = requiredElement<HTMLButtonElement>('deliver-export')
const deliveryResult = requiredElement<HTMLOutputElement>('delivery-result')

input.addEventListener('change', () => {
  void inspectSelection(input.files?.[0] ?? null)
})

deliver.addEventListener('click', () => {
  /*
   * This File stands in only for an opaque result already produced and
   * verified by the absent Rust runtime. It is not runtime acceptance evidence.
   */
  const archive = new File(
    [
      new Uint8Array([
        0x4c, 0x69, 0x66, 0x65, 0x41, 0x72, 0x63, 0x68, 0x69, 0x76, 0x65,
      ]),
    ],
    'runtime-simulated-export.lifearchive.tar',
    { type: ARCHIVE_TRANSPORT_MIME_TYPE },
  )
  const result = deliverArchiveDownload(archive)
  deliveryResult.dataset.outcome = result.outcome
  deliveryResult.textContent = JSON.stringify(result)
})

async function inspectSelection(file: File | null): Promise<void> {
  if (!file) return
  const selection = selectArchiveTransport(file)
  selectionResult.dataset.outcome = selection.outcome
  if (selection.outcome === 'rejected') {
    selectionResult.textContent = JSON.stringify(selection)
    return
  }

  const digest = await crypto.subtle.digest(
    'SHA-256',
    await new Response(selection.stream).arrayBuffer(),
  )
  const sha256 = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
  selectionResult.textContent = JSON.stringify({
    outcome: selection.outcome,
    name: selection.file.name,
    mimeType: selection.file.type,
    byteLength: selection.byteLength,
    sha256,
  })
}

function requiredElement<ElementType extends HTMLElement>(
  id: string,
): ElementType {
  const element = document.getElementById(id)
  if (!element) throw new Error(`Missing test harness element: ${id}`)
  return element as ElementType
}
