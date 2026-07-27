import { createHash } from 'node:crypto'
import { expect, test } from './qualified-browser-fixtures'

const ADAPTER_HARNESS_URL = 'http://localhost:4187/e2e/archive-transfer.html'

/**
 * This crosses the production browser archive adapter in real engines.
 *
 * The selected File is a browser-backed acquisition input. The export File is
 * explicitly a simulated runtime result because runtime/runtime.lock.json is
 * not integrated. These tests prove only byte-preserving browser handoff, not
 * Rust archive correctness, persistence, import atomicity, or runtime
 * acceptance.
 */
test.describe('archive browser adapter (simulated runtime side)', () => {
  test('streams a browser-selected archive without changing bytes', async ({
    page,
  }) => {
    await page.goto(ADAPTER_HARNESS_URL)

    const bytes = Buffer.alloc(8 * 1024 * 1024 + 3)
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = (index * 31 + 17) & 0xff
    }
    const sha256 = createHash('sha256').update(bytes).digest('hex')

    await page.setInputFiles('#archive-input', {
      name: 'Synthetic.lifearchive.tar',
      mimeType: 'application/x-tar',
      buffer: bytes,
    })

    await expect(page.locator('#selection-result')).toHaveAttribute(
      'data-outcome',
      'selected',
    )
    await expect(page.locator('#selection-result')).toContainText(sha256)
    await expect(page.locator('#selection-result')).toContainText(
      String(bytes.length),
    )
  })

  test('delivers simulated runtime output through the production adapter', async ({
    page,
  }) => {
    await page.goto(ADAPTER_HARNESS_URL)

    const downloadPromise = page.waitForEvent('download')
    await page
      .getByRole('button', { name: 'Hand off simulated export' })
      .click()
    const download = await downloadPromise
    const stream = await download.createReadStream()
    const chunks: Buffer[] = []
    for await (const chunk of stream) chunks.push(Buffer.from(chunk))

    await expect(page.locator('#delivery-result')).toHaveAttribute(
      'data-outcome',
      'handed-off',
    )
    expect(download.suggestedFilename()).toBe(
      'runtime-simulated-export.lifearchive.tar',
    )
    expect(Buffer.concat(chunks)).toEqual(
      Buffer.from([
        0x4c, 0x69, 0x66, 0x65, 0x41, 0x72, 0x63, 0x68, 0x69, 0x76, 0x65,
      ]),
    )
  })
})
