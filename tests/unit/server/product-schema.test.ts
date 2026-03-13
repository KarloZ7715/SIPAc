import { describe, expect, it } from 'vitest'
import { updateProductSchema } from '../../../server/utils/schemas/product'

describe('updateProductSchema', () => {
  it('accepts productType for manual correction', () => {
    const parsed = updateProductSchema.safeParse({
      productType: 'thesis',
      action: 'save-draft',
    })

    expect(parsed.success).toBe(true)
  })

  it('rejects an unsupported productType', () => {
    const parsed = updateProductSchema.safeParse({
      productType: 'memo',
    })

    expect(parsed.success).toBe(false)
  })
})
