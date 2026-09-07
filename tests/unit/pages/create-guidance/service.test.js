vi.mock('../../../../src/services/uploader.js', () => ({
  getUploadStatus: vi.fn(),
  initiateUpload: vi.fn()
}))

vi.mock('../../../../src/pages/create-guidance/session.js', () => ({
  getGuideUpload: vi.fn(),
  setGuideUploadCompletedSteps: vi.fn()
}))

import { getUploadStatus, initiateUpload } from '../../../../src/services/uploader.js'
import { getGuideUpload, setGuideUploadCompletedSteps } from '../../../../src/pages/create-guidance/session.js'
import {
  checkUploadHandleStatus,
  getGuideUploadProgress,
  RESULTS,
  startMigration
} from '../../../../src/pages/create-guidance/service.js'

describe('create-guidance service', () => {
  let request

  beforeEach(() => {
    request = {}
    vi.clearAllMocks()
  })

  describe('startMigration', () => {
    test('initiates a new upload and returns MIGRATION_STARTED with the new id when none exists', async () => {
      const upload = { hasUpload: () => false }
      initiateUpload.mockResolvedValue({ uploadId: 'new-upload-id' })

      const result = await startMigration(upload)

      expect(result).toEqual({ code: RESULTS.MIGRATION_STARTED, uploadId: 'new-upload-id' })
      expect(getUploadStatus).not.toHaveBeenCalled()
    })

    test('throws when the existing upload status cannot be retrieved', async () => {
      const upload = { hasUpload: () => true, activeUploadId: 'u-1' }
      getUploadStatus.mockResolvedValue(null)

      await expect(startMigration(upload)).rejects.toThrow('Failed to retrieve upload status')
    })

    test('returns UPLOAD_AVAILABLE when the existing upload status is initiated', async () => {
      const upload = { hasUpload: () => true, activeUploadId: 'u-1' }
      getUploadStatus.mockResolvedValue({ uploadStatus: 'initiated' })

      const result = await startMigration(upload)

      expect(result).toEqual({ code: RESULTS.UPLOAD_AVAILABLE })
      expect(getUploadStatus).toHaveBeenCalledWith('u-1')
    })

    test('returns UPLOAD_EXPENDED when the existing upload status is anything other than initiated', async () => {
      const upload = { hasUpload: () => true, activeUploadId: 'u-1' }
      getUploadStatus.mockResolvedValue({ uploadStatus: 'ready' })

      const result = await startMigration(upload)

      expect(result).toEqual({ code: RESULTS.UPLOAD_EXPENDED })
    })
  })

  describe('checkUploadHandleStatus', () => {
    test('returns NO_UPLOAD when no upload exists', async () => {
      getGuideUpload.mockReturnValue(null)

      const result = await checkUploadHandleStatus(request)

      expect(result.code).toBe(RESULTS.NO_UPLOAD)
    })

    test('returns UPLOAD_AVAILABLE when upload is still initiated', async () => {
      getGuideUpload.mockReturnValue({ activeUploadId: 'u-1', hasUpload: () => true })
      getUploadStatus.mockResolvedValue({
        uploadStatus: 'initiated',
        isReady: false
      })

      const result = await checkUploadHandleStatus(request)

      expect(result.code).toBe(RESULTS.UPLOAD_AVAILABLE)
    })

    test('returns UPLOAD_EXPENDED when upload has progressed', async () => {
      getGuideUpload.mockReturnValue({ activeUploadId: 'u-1', hasUpload: () => true })
      getUploadStatus.mockResolvedValue({
        uploadStatus: 'pending',
        isReady: false
      })

      const result = await checkUploadHandleStatus(request)

      expect(result.code).toBe(RESULTS.UPLOAD_EXPENDED)
    })

    test('returns UPLOAD_EXPENDED when upload status cannot be found', async () => {
      getGuideUpload.mockReturnValue({ activeUploadId: 'u-1', hasUpload: () => true })
      getUploadStatus.mockResolvedValue(null)

      const result = await checkUploadHandleStatus(request)

      expect(result.code).toBe(RESULTS.UPLOAD_EXPENDED)
    })
  })

  describe('getGuideUploadProgress', () => {
    test('reports the synthetic initial status on the very first call, without checking anything', async () => {
      getGuideUpload.mockReturnValue({ completedStepIds: [] })

      const progress = await getGuideUploadProgress(request, 'u-1')

      expect(progress.statusId).toBe('initial')
      expect(progress.label).toBe('Checking your file')
      expect(progress.percentage).toBe(25)
      expect(progress.isComplete).toBe(false)
      expect(progress.isError).toBe(false)
      expect(getUploadStatus).not.toHaveBeenCalled()
    })

    test('persists initial as complete after reporting it once', async () => {
      const originalCompletedStepIds = []
      getGuideUpload.mockReturnValue({ completedStepIds: originalCompletedStepIds })

      await getGuideUploadProgress(request, 'u-1')

      expect(setGuideUploadCompletedSteps).toHaveBeenCalledWith(request, ['initial'])

      expect(originalCompletedStepIds).toEqual([])
    })

    test('does not re-report initial once it has been persisted as complete', async () => {
      getGuideUpload.mockReturnValue({ completedStepIds: ['initial'] })
      getUploadStatus.mockResolvedValue({
        uploadStatus: 'pending',
        isReady: false
      })

      const progress = await getGuideUploadProgress(request, 'u-1')

      expect(progress.statusId).toBe('uploader:pending')
      expect(progress.label).toBe('Scanning for viruses')
      expect(progress.percentage).toBe(50)
      expect(progress.isComplete).toBe(false)
      expect(progress.isError).toBe(false)
    })

    test('returns error state when upload has failed', async () => {
      getGuideUpload.mockReturnValue({ completedStepIds: ['initial'] })
      getUploadStatus.mockResolvedValue({
        uploadStatus: 'ready',
        isReady: true,
        hasRejectedFiles: true
      })

      const progress = await getGuideUploadProgress(request, 'u-1')

      expect(progress.statusId).toBe('uploader:failed')
      expect(progress.isError).toBe(true)
    })

    test('returns ready state when upload is ready', async () => {
      getGuideUpload.mockReturnValue({ completedStepIds: ['initial'] })
      getUploadStatus.mockResolvedValue({
        uploadStatus: 'ready',
        isReady: true
      })

      const progress = await getGuideUploadProgress(request, 'u-1')

      expect(progress.isComplete).toBe(true)
    })

    test('skips re-checking completed steps', async () => {
      const mockUpload = {
        completedStepIds: ['initial', 'scanning']
      }

      getGuideUpload.mockReturnValue(mockUpload)
      getUploadStatus.mockResolvedValue({
        uploadStatus: 'ready',
        isReady: true
      })

      await getGuideUploadProgress(request, 'u-1')

      expect(getUploadStatus).not.toHaveBeenCalled()
    })

    test('persists newly completed steps to session', async () => {
      const originalCompletedStepIds = ['initial']
      getGuideUpload.mockReturnValue({ completedStepIds: originalCompletedStepIds })
      getUploadStatus.mockResolvedValue({
        uploadStatus: 'ready',
        isReady: true
      })

      await getGuideUploadProgress(request, 'u-1')

      expect(setGuideUploadCompletedSteps).toHaveBeenCalled()

      const call = setGuideUploadCompletedSteps.mock.calls[0]

      expect(call[0]).toBe(request)
      expect(call[1]).toContain('scanning')

      expect(originalCompletedStepIds).toEqual(['initial'])
    })

    test('does not persist when the completed steps have not changed', async () => {
      getGuideUpload.mockReturnValue({ completedStepIds: ['initial', 'scanning'] })
      getUploadStatus.mockResolvedValue({
        uploadStatus: 'ready',
        isReady: true
      })

      await getGuideUploadProgress(request, 'u-1')

      expect(setGuideUploadCompletedSteps).not.toHaveBeenCalled()
    })

    test('handles missing upload gracefully', async () => {
      getGuideUpload.mockReturnValue(null)

      const progress = await getGuideUploadProgress(request, 'u-1')

      expect(progress).toBeDefined()
      expect(progress.statusId).toBe('initial')
      expect(progress.isError).toBe(false)
    })
  })

  describe('RESULTS', () => {
    test('defines all expected result codes', () => {
      expect(RESULTS.MIGRATION_STARTED).toBeDefined()
      expect(RESULTS.NO_UPLOAD).toBeDefined()
      expect(RESULTS.UPLOAD_AVAILABLE).toBeDefined()
      expect(RESULTS.UPLOAD_EXPENDED).toBeDefined()
    })
  })
})
