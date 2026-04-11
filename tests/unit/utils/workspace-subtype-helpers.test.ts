import { describe, expect, it } from 'vitest'
import { splitMultivalue, toIsoDate, toNumberValue } from '~~/app/utils/workspace-subtype-helpers'

describe('workspace-subtype-helpers', () => {
  it('splitMultivalue returns undefined for blank input', () => {
    expect(splitMultivalue('   ')).toBeUndefined()
  })

  it('splitMultivalue splits on comma and newline', () => {
    expect(splitMultivalue('a, b\nc')).toEqual(['a', 'b', 'c'])
  })

  it('toNumberValue rejects non-finite', () => {
    expect(toNumberValue('')).toBeUndefined()
    expect(toNumberValue('x')).toBeUndefined()
    expect(toNumberValue('12')).toBe(12)
  })

  it('toIsoDate parses valid date string', () => {
    const iso = toIsoDate('2020-01-15')
    expect(iso).toMatch(/2020-01-15/)
  })
})
