import { describe, expect, it } from 'vitest'
import { classifyPipelineError, withTimeout } from '../../../server/utils/pipeline-observability'

describe('pipeline-observability', () => {
  it('classifies known timeout and rate limit errors', () => {
    const timeoutError = classifyPipelineError(
      new Error('request timed out while calling provider'),
    )
    const rateLimitError = classifyPipelineError(new Error('HTTP 429 rate limit exceeded'))

    expect(timeoutError.errorType).toBe('timeout')
    expect(rateLimitError.errorType).toBe('rate_limit')
  })

  it('returns no_object_generated classification by error name', () => {
    const synthetic = Object.assign(new Error('No object was generated'), {
      name: 'NoObjectGeneratedError',
    })

    const classified = classifyPipelineError(synthetic)

    expect(classified.errorType).toBe('no_object_generated')
  })

  it('resolves when task finishes before timeout', async () => {
    const result = await withTimeout({
      label: 'fast_task',
      timeoutMs: 200,
      run: async () => 'ok',
    })

    expect(result).toBe('ok')
  })

  it('rejects when task exceeds timeout', async () => {
    await expect(
      withTimeout({
        label: 'slow_task',
        timeoutMs: 20,
        run: async () => {
          await new Promise((resolve) => setTimeout(resolve, 80))
          return 'late'
        },
      }),
    ).rejects.toThrow(/slow_task timed out after 20ms/i)
  })
})
