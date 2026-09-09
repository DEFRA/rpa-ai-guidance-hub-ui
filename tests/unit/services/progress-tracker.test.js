import { ProgressTracker } from '../../../src/services/progress-tracker.js'

describe('ProgressTracker', () => {
  test('returns no completed steps when none are passed in', async () => {
    const steps = [
      {
        id: 'step-1',
        label: 'First',
        check: async function () { return { complete: false } }
      }
    ]
    const tracker = new ProgressTracker(steps)
    const status = await tracker.getStatus('context')

    expect(status.completedStepIds).toEqual([])
  })

  test('hydrates from existing completed step IDs passed to getStatus', async () => {
    const checks = {
      step1: vi.fn(async () => ({ complete: true })),
      step2: vi.fn(async () => ({ complete: false }))
    }
    const steps = [
      { id: 'step-1', label: 'First', check: checks.step1 },
      { id: 'step-2', label: 'Second', check: checks.step2 }
    ]
    const tracker = new ProgressTracker(steps)

    await tracker.getStatus('context', ['step-1'])

    expect(checks.step1).not.toHaveBeenCalled()
    expect(checks.step2).toHaveBeenCalled()
  })

  test('does not mutate the completedStepIds array passed in', async () => {
    const steps = [
      {
        id: 'step-1',
        label: 'First',
        check: async function () { return { complete: true } }
      }
    ]
    const tracker = new ProgressTracker(steps)
    const originalCompletedStepIds = []

    const status = await tracker.getStatus('context', originalCompletedStepIds)

    expect(originalCompletedStepIds).toEqual([])
    expect(status.completedStepIds).toEqual(['step-1'])
  })

  test('is safe to reuse across multiple calls with different completedStepIds', async () => {
    const steps = [
      {
        id: 'step-1',
        label: 'First',
        check: async function () { return { complete: true } }
      },
      {
        id: 'step-2',
        label: 'Second',
        check: async function () { return { complete: false } }
      }
    ]
    const tracker = new ProgressTracker(steps)

    const first = await tracker.getStatus('context', [])
    const second = await tracker.getStatus('context', [])

    expect(first.completedStepIds).toEqual(['step-1'])
    expect(second.completedStepIds).toEqual(['step-1'])
  })

  test('returns the first incomplete step when checking status', async () => {
    const steps = [
      {
        id: 'step-1',
        label: 'First',
        check: async function () { return { complete: true } }
      },
      {
        id: 'step-2',
        label: 'Second',
        check: async function () { return { complete: false } }
      }
    ]
    const tracker = new ProgressTracker(steps)
    const status = await tracker.getStatus('context')

    expect(status.stepId).toBe('step-2')
    expect(status.currentIndex).toBe(1)
    expect(status.isComplete).toBe(false)
    expect(status.isError).toBe(false)
  })

  test('marks a step as completed when its check returns complete', async () => {
    const steps = [
      {
        id: 'step-1',
        label: 'First',
        check: async function () { return { complete: true } }
      }
    ]
    const tracker = new ProgressTracker(steps)
    const status = await tracker.getStatus('context')

    expect(status.completedStepIds).toContain('step-1')
    expect(status.isComplete).toBe(true)
  })

  test('skips already-completed steps', async () => {
    const checks = {
      step1: vi.fn(async () => ({ complete: true })),
      step2: vi.fn(async () => ({ complete: true }))
    }

    const steps = [
      {
        id: 'step-1',
        label: 'First',
        check: checks.step1
      },
      {
        id: 'step-2',
        label: 'Second',
        check: checks.step2
      }
    ]

    const tracker = new ProgressTracker(steps)
    await tracker.getStatus('context', ['step-1'])

    expect(checks.step1).not.toHaveBeenCalled()
    expect(checks.step2).toHaveBeenCalled()
  })

  test('returns error state when a step check returns error', async () => {
    const steps = [
      {
        id: 'step-1',
        label: 'First',
        check: async function () { return { complete: false, error: true } }
      }
    ]
    const tracker = new ProgressTracker(steps)
    const status = await tracker.getStatus('context')

    expect(status.stepId).toBe('step-1')
    expect(status.isError).toBe(true)
    expect(status.isComplete).toBe(false)
  })

  test('stops checking after finding an incomplete step', async () => {
    const checks = {
      step1: vi.fn(async () => ({ complete: true })),
      step2: vi.fn(async () => ({ complete: false })),
      step3: vi.fn(async () => ({ complete: true }))
    }

    const steps = [
      {
        id: 'step-1',
        label: 'First',
        check: checks.step1
      },
      {
        id: 'step-2',
        label: 'Second',
        check: checks.step2
      },
      {
        id: 'step-3',
        label: 'Third',
        check: checks.step3
      }
    ]

    const tracker = new ProgressTracker(steps)
    await tracker.getStatus('context')

    expect(checks.step1).toHaveBeenCalled()
    expect(checks.step2).toHaveBeenCalled()
    expect(checks.step3).not.toHaveBeenCalled()
  })

  test('passes the context parameter to step check functions', async () => {
    const check = vi.fn(async () => ({ complete: true }))
    const steps = [
      {
        id: 'step-1',
        label: 'First',
        check
      }
    ]
    const tracker = new ProgressTracker(steps)
    const context = { uploadId: 'u-123' }

    await tracker.getStatus(context)

    expect(check).toHaveBeenCalledWith(context)
  })

  test('returns complete and last step index when all steps are done', async () => {
    const steps = [
      {
        id: 'step-1',
        label: 'First',
        check: async function () { return { complete: true } }
      },
      {
        id: 'step-2',
        label: 'Second',
        check: async function () { return { complete: true } }
      }
    ]
    const tracker = new ProgressTracker(steps)
    const status = await tracker.getStatus('context')

    expect(status.isComplete).toBe(true)
    expect(status.currentIndex).toBe(1)
    expect(status.stepId).toBe('step-2')
    expect(status.completedStepIds).toEqual(['step-1', 'step-2'])
  })
})

describe('ProgressTracker failure details', () => {
  test('hands back the failure a check reports on error', async () => {
    const failure = { statusId: 'uploader:rejected', message: 'The selected file contains a virus' }
    const steps = [
      {
        id: 'step-1',
        label: 'First',
        check: async function () { return { complete: false, error: true, failure } }
      }
    ]
    const tracker = new ProgressTracker(steps)
    const status = await tracker.getStatus('context')

    expect(status.isError).toBe(true)
    expect(status.failure).toBe(failure)
  })

  test('reports no failure when a check errors without one', async () => {
    const steps = [
      {
        id: 'step-1',
        label: 'First',
        check: async function () { return { complete: false, error: true } }
      }
    ]
    const tracker = new ProgressTracker(steps)
    const status = await tracker.getStatus('context')

    expect(status.failure).toBeUndefined()
  })
})
