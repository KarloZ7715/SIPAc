import { describe, expect, it } from 'vitest'
import { uploadMetadataSchema } from '../../../server/utils/schemas/upload'

describe('uploadMetadataSchema', () => {
  it('accepts missing productType for the document workspace flow', () => {
    const parsed = uploadMetadataSchema.safeParse({})

    expect(parsed.success).toBe(true)
  })

  it('accepts undefined productType when the field is omitted', () => {
    const parsed = uploadMetadataSchema.safeParse({ productType: undefined })

    expect(parsed.success).toBe(true)
  })

  it('rejects invalid productType values', () => {
    const parsed = uploadMetadataSchema.safeParse({ productType: 'memo' })

    expect(parsed.success).toBe(false)
  })
})
