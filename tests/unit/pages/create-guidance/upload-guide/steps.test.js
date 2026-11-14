import { getStepState, STATUS_IDS, STEPS } from '../../../../../src/pages/create-guidance/upload-guide/steps.js'
import { UPLOAD_STEP_MESSAGES } from '../../../../fixtures/messages.js'

describe('upload guide steps', () => {
  test('lists scanning and parse steps', () => {
    expect(STEPS.map((step) => step.id)).toEqual(['scanning', 'parse'])
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
      [STATUS_IDS.UPLOADER_FAILED, 'Scan failed', UPLOAD_STEP_MESSAGES.notChecked],
      [STATUS_IDS.UPLOADER_REJECTED, 'File rejected', UPLOAD_STEP_MESSAGES.notUploaded],
      [STATUS_IDS.UPLOADER_NO_FILE, 'No file uploaded', UPLOAD_STEP_MESSAGES.noFile],
      [STATUS_IDS.UPLOADER_MISSING, 'Upload not found', UPLOAD_STEP_MESSAGES.notFound]
    ])('%s is an error state with a user-facing message', (statusId, label, message) => {
      const state = getStepState(statusId)

      expect(state.isError).toBe(true)
      expect(state.label).toBe(label)
      expect(state.message).toBe(message)
    })

    test('parse:failed explains the file could not be opened, with supporting detail', () => {
      const state = getStepState(STATUS_IDS.PARSE_FAILED)

      expect(state.isError).toBe(true)
      expect(state.label).toBe('File could not be opened')
      expect(state.message).toBe(UPLOAD_STEP_MESSAGES.cannotOpen)
      expect(state.detail).toBe(UPLOAD_STEP_MESSAGES.cannotOpenDetail)
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
