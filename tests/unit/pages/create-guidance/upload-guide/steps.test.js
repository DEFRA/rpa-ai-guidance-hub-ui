import { getStepState, STATUS_IDS, STEPS } from '../../../../../src/pages/create-guidance/upload-guide/steps.js'

describe('upload guide steps', () => {
  test('lists scanning and minimal-parse steps', () => {
    expect(STEPS.map((step) => step.id)).toEqual(['scanning', 'minimalParse'])
  })

  describe('getStepState', () => {
    test('returns state for uploader:pending', () => {
      expect(getStepState(STATUS_IDS.UPLOADER_PENDING)).toEqual({
        stepId: 'scanning',
        label: 'Scanning for viruses',
        percentage: 50,
        isError: false
      })
    })

    test('returns state for uploader:complete', () => {
      expect(getStepState(STATUS_IDS.UPLOADER_COMPLETE)).toEqual({
        stepId: 'scanning',
        label: 'File scanned successfully',
        percentage: 100,
        isError: false
      })
    })

    test.each([
      [STATUS_IDS.UPLOADER_FAILED, 'Scan failed'],
      [STATUS_IDS.UPLOADER_REJECTED, 'File rejected'],
      [STATUS_IDS.UPLOADER_NO_FILE, 'No file uploaded'],
      [STATUS_IDS.UPLOADER_MISSING, 'Upload not found']
    ])('%s is an error state with a user-facing message', (statusId, label) => {
      const state = getStepState(statusId)

      expect(state.isError).toBe(true)
      expect(state.label).toBe(label)
      expect(state.message).toEqual(expect.any(String))
    })

    test('falls back to uploader:pending for unknown status', () => {
      const state = getStepState('unknown:status')

      expect(state.label).toBe('Scanning for viruses')
      expect(state.percentage).toBe(50)
    })

    test('completion is further along than scanning', () => {
      expect(getStepState(STATUS_IDS.UPLOADER_COMPLETE).percentage)
        .toBeGreaterThan(getStepState(STATUS_IDS.UPLOADER_PENDING).percentage)
    })
  })
})
