import { Transform } from 'node:stream'
import { StringDecoder } from 'node:string_decoder'

const MASK = '***'

// ponytail: secrets shorter than this are not scrubbed — too likely to mangle
// normal output (a 2-char value would mask common substrings). Upgrade path:
// make it configurable if it ever bites.
export const MIN_SCRUB_LEN = 6

/** Replace every complete occurrence of each secret with the mask. Longest-first
 * so an overlapping shorter secret can't partially mask a longer one. Pure. */
export function redact(text: string, secrets: string[]): string {
  let out = text
  const sorted = [...secrets].sort((a, b) => b.length - a.length)
  for (const s of sorted) {
    if (!s) continue
    out = out.split(s).join(MASK)
  }
  return out
}

/** Streaming-safe scrubber. A secret can straddle chunk boundaries, so we hold
 * back the last (maxLen-1) chars of each redacted chunk as carry — any partial
 * (not-yet-complete) match lives entirely within that window and gets resolved
 * when the next chunk arrives. */
export function createScrubStream(secretValues: string[]): Transform {
  const secrets = [...new Set(secretValues.filter((v) => v && v.length >= MIN_SCRUB_LEN))].sort(
    (a, b) => b.length - a.length,
  )
  const maxLen = secrets.reduce((m, s) => Math.max(m, s.length), 0)
  const hold = Math.max(0, maxLen - 1)
  const decoder = new StringDecoder('utf8')
  let carry = ''

  return new Transform({
    transform(chunk, _enc, cb) {
      const combined = carry + decoder.write(chunk as Buffer)
      const r = redact(combined, secrets)
      if (r.length <= hold) {
        carry = r
        cb()
        return
      }
      carry = r.slice(r.length - hold)
      cb(null, r.slice(0, r.length - hold))
    },
    flush(cb) {
      cb(null, redact(carry + decoder.end(), secrets))
    },
  })
}
