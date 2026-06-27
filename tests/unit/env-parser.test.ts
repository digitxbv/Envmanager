import { describe, expect, it } from 'vitest'
import { parseDotEnv } from '../../app/utils/parsers/envParser'

describe('parseDotEnv', () => {
  it('keeps the first value for duplicate keys and reports a warning', () => {
    const result = parseDotEnv([
      'API_URL=https://first.example.com',
      'TOKEN=abc123',
      'API_URL=https://second.example.com'
    ].join('\n'))

    expect(result.variables).toEqual([
      {
        key: 'API_URL',
        value: 'https://first.example.com',
        isSecret: false
      },
      {
        key: 'TOKEN',
        value: 'abc123',
        isSecret: true
      }
    ])
    expect(result.warnings).toEqual([
      'Duplicate key "API_URL" on line 3 was ignored; using the first value.'
    ])
    expect(result.errors).toEqual([])
  })
})
