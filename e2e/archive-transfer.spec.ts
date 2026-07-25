import { expect, test } from '@playwright/test'

test('streams a synthetic archive file without changing bytes', async ({
  page,
}) => {
  await page.goto('/settings')
  await page.setContent('<input id="archive" type="file">')
  const bytes = Buffer.alloc(8 * 1024 * 1024 + 3)
  bytes[0] = 0x1f
  bytes[bytes.length - 1] = 0xa5
  await page.setInputFiles('#archive', {
    name: 'Synthetic.lifearchive.tar',
    mimeType: 'application/x-tar',
    buffer: bytes,
  })

  const result = await page.evaluate(async () => {
    const input = document.querySelector<HTMLInputElement>('#archive')
    const file = input?.files?.[0]
    if (!file) throw new Error('synthetic file selection failed')
    const reader = file.stream().getReader()
    let count = 0
    let first: number | undefined
    let last: number | undefined

    for (;;) {
      const chunk = await reader.read()
      if (chunk.done) break
      first ??= chunk.value[0]
      last = chunk.value[chunk.value.length - 1]
      count += chunk.value.length
    }

    return {
      name: file.name,
      type: file.type,
      size: file.size,
      count,
      first,
      last,
    }
  })

  expect(result).toEqual({
    name: 'Synthetic.lifearchive.tar',
    type: 'application/x-tar',
    size: 8 * 1024 * 1024 + 3,
    count: 8 * 1024 * 1024 + 3,
    first: 0x1f,
    last: 0xa5,
  })
})

test('creates and revokes an archive download object URL', async ({ page }) => {
  await page.goto('/settings')

  const downloadPromise = page.waitForEvent('download')
  const metadata = await page.evaluate(() => {
    const file = new File(
      [new Uint8Array([0x61, 0x62, 0x63])],
      'Synthetic.lifearchive.tar',
      { type: 'application/x-tar' },
    )
    const url = URL.createObjectURL(file)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = file.name
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 100)
    return { name: file.name, type: file.type }
  })
  const download = await downloadPromise
  const stream = await download.createReadStream()
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(Buffer.from(chunk))

  expect(metadata).toEqual({
    name: 'Synthetic.lifearchive.tar',
    type: 'application/x-tar',
  })
  expect(download.suggestedFilename()).toBe('Synthetic.lifearchive.tar')
  expect(Buffer.concat(chunks)).toEqual(Buffer.from([0x61, 0x62, 0x63]))
})
