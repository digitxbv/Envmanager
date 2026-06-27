import { describe, it, expect } from 'vitest'
import { selectScopedVars, substitutePlaceholders } from '../../src/lib/run-core'
import type { Variable } from '../../src/lib/types'

const V = (key: string, value: string | null = 'v', is_secret = false): Variable => ({
  key,
  value,
  is_secret,
})
const vars = [V('A'), V('B'), V('C', 'sec', true)]

describe('selectScopedVars', () => {
  it('--only picks the listed keys', () => {
    expect(selectScopedVars(vars, { only: ['A', 'C'] }).map((v) => v.key)).toEqual(['A', 'C'])
  })

  it('--only with an unknown key throws (catches typos)', () => {
    expect(() => selectScopedVars(vars, { only: ['A', 'NOPE'] })).toThrow(/NOPE/)
  })

  it('--all returns everything', () => {
    expect(selectScopedVars(vars, { all: true }).map((v) => v.key)).toEqual(['A', 'B', 'C'])
  })

  it('--except removes keys from --all', () => {
    expect(selectScopedVars(vars, { all: true, except: ['B'] }).map((v) => v.key)).toEqual(['A', 'C'])
  })

  it('--except with an unknown key throws (a typo must not silently leave a secret exposed)', () => {
    expect(() => selectScopedVars(vars, { all: true, except: ['NOPE'] })).toThrow(/NOPE/)
  })

  it('uses config allow-list when no flag is given', () => {
    expect(selectScopedVars(vars, { configKeys: ['B'] }).map((v) => v.key)).toEqual(['B'])
  })

  it('--except filters within the config allow-list', () => {
    expect(selectScopedVars(vars, { configKeys: ['A', 'B'], except: ['A'] }).map((v) => v.key)).toEqual(['B'])
  })

  it('throws when no scope is set at all', () => {
    expect(() => selectScopedVars(vars, {})).toThrow(/No variable scope/)
  })

  it('throws a clear error on an explicitly empty allow-list', () => {
    expect(() => selectScopedVars(vars, { only: [] })).toThrow(/Empty variable allow-list/)
  })
})

describe('substitutePlaceholders', () => {
  const values = new Map([['TOKEN', 'abc123']])

  it('replaces {{KEY}} (with surrounding whitespace tolerance)', () => {
    expect(substitutePlaceholders(['Bearer {{TOKEN}}', '{{ TOKEN }}'], values)).toEqual([
      'Bearer abc123',
      'abc123',
    ])
  })

  it('throws fail-closed on an unresolved placeholder', () => {
    expect(() => substitutePlaceholders(['{{MISSING}}'], values)).toThrow(/MISSING/)
  })

  it('leaves args without placeholders untouched', () => {
    expect(substitutePlaceholders(['curl', '-H'], values)).toEqual(['curl', '-H'])
  })
})
