import { getStepState } from '../../../../../src/pages/create-guidance/upload-guide/steps.js'

describe('upload guide steps', () => {
  describe('getStepState', () => {
    test('returns state for uploader:pending', () => {
      const state = getStepState('uploader:pending')

      expect(state).toEqual({
        stepId: 'scanning',
        label: 'Scanning for viruses',
        currentIndex: 1,
        percentage: 50,
        isError: false
      })
    })

    test('returns state for uploader:complete', () => {
      const state = getStepState('uploader:complete')

      expect(state).toEqual({
        stepId: 'scanning',
        label: 'File scanned successfully',
        currentIndex: 2,
        percentage: 100,
        isError: false
      })
    })

    test('returns state for uploader:failed', () => {
      const state = getStepState('uploader:failed')

      expect(state).toEqual({
        stepId: 'scanning',
        label: 'Scan failed',
        currentIndex: 1,
        percentage: 50,
        isError: true
      })
    })

    test('falls back to uploader:pending for unknown status', () => {
      const state = getStepState('unknown:status')

      expect(state.label).toBe('Scanning for viruses')
      expect(state.percentage).toBe(50)
    })

    test('percentage increases with each step', () => {
      const step1 = getStepState('initial')
      const step2 = getStepState('uploader:pending')

      expect(step2.percentage).toBeGreaterThan(step1.percentage)
    })
  })
})
