import { describe, it, expect } from 'vitest'
import { redact, createScrubStream, MIN_SCRUB_LEN } from '../../src/lib/scrub'

// Pipe input chunks through the scrub stream and collect the output string.
async function scrub(chunks: string[], secrets: string[]): Promise<string> {
  const stream = createScrubStream(secrets)
  const out: Buffer[] = []
  stream.on('data', (c: Buffer) => out.push(Buffer.from(c)))
  const done = new Promise<void>((resolve) => stream.on('end', () => resolve()))
  for (const c of chunks) stream.write(c)
  stream.end()
  await done
  return Buffer.concat(out).toString('utf8')
}

describe('redact (pure)', () => {
  it('replaces every occurrence with the mask', () => {
    expect(redact('a SECRETVAL b SECRETVAL', ['SECRETVAL'])).toBe('a *** b ***')
  })

  it('masks longest secret first so it is not partially masked', () => {
    // "SECRETVALUE" contains "SECRET"; longest-first must win.
    expect(redact('SECRETVALUE', ['SECRET', 'SECRETVALUE'])).toBe('***')
  })
})

describe('createScrubStream', () => {
  it('masks a secret contained in a single chunk', async () => {
    expect(await scrub(['token=SECRETVAL!'], ['SECRETVAL'])).toBe('token=***!')
  })

  it('masks a secret split across two chunks', async () => {
    expect(await scrub(['token=SECR', 'ETVAL!'], ['SECRETVAL'])).toBe('token=***!')
  })

  it('does not mask values shorter than MIN_SCRUB_LEN', async () => {
    const short = 'abc' // length < MIN_SCRUB_LEN
    expect(short.length).toBeLessThan(MIN_SCRUB_LEN)
    expect(await scrub([`x=${short} y`], [short])).toBe(`x=${short} y`)
  })

  it('masks multiple distinct secrets across chunks', async () => {
    expect(await scrub(['AAAAAA-', 'BBBBBB'], ['AAAAAA', 'BBBBBB'])).toBe('***-***')
  })
})
