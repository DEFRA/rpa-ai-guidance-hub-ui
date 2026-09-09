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
  getUploadOutcome,
  getGuideUploadProgress,
  RESULTS,
  startMigration
} from '../../../../src/pages/create-guidance/service.js'

const initiated = { uploadStatus: 'initiated', isReady: false, files: [], hasRejectedFiles: false }
const pending = { uploadStatus: 'pending', isReady: false, files: [{ fileStatus: 'pending' }], hasRejectedFiles: false }
const complete = { uploadStatus: 'ready', isReady: true, files: [{ fileStatus: 'complete' }], hasRejectedFiles: false }
const noFile = { uploadStatus: 'ready', isReady: true, files: [], hasRejectedFiles: false }
const rejected = {
  uploadStatus: 'ready',
  isReady: true,
  hasRejectedFiles: true,
  files: [{ fileStatus: 'rejected', error: { code: 'FILE_VIRUS', message: 'The selected file contains a virus' } }]
}

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

    test('returns UPLOAD_AVAILABLE when the existing upload is still initiated', async () => {
      const upload = { hasUpload: () => true, activeUploadId: 'u-1' }
      getUploadStatus.mockResolvedValue(initiated)

      const result = await startMigration(upload)

      expect(result).toEqual({ code: RESULTS.UPLOAD_AVAILABLE })
      expect(getUploadStatus).toHaveBeenCalledWith('u-1')
      expect(initiateUpload).not.toHaveBeenCalled()
    })

    test('returns UPLOAD_PENDING while the existing upload is being scanned', async () => {
      const upload = { hasUpload: () => true, activeUploadId: 'u-1' }
      getUploadStatus.mockResolvedValue(pending)

      const result = await startMigration(upload)

      expect(result).toEqual({ code: RESULTS.UPLOAD_PENDING })
    })

    test('returns UPLOAD_COMPLETE when the existing upload scanned clean', async () => {
      const upload = { hasUpload: () => true, activeUploadId: 'u-1' }
      getUploadStatus.mockResolvedValue(complete)

      const result = await startMigration(upload)

      expect(result).toEqual({ code: RESULTS.UPLOAD_COMPLETE })
    })

    test.each([
      ['was rejected', rejected],
      ['had no file', noFile],
      ['is no longer known to cdp-uploader', null]
    ])('initiates a fresh upload when the existing one %s', async (_label, status) => {
      const upload = { hasUpload: () => true, activeUploadId: 'u-1' }
      getUploadStatus.mockResolvedValue(status)
      initiateUpload.mockResolvedValue({ uploadId: 'u-2' })

      const result = await startMigration(upload)

      expect(result).toEqual({ code: RESULTS.MIGRATION_STARTED, uploadId: 'u-2' })
    })

    test('passes the redirect and destination bucket to cdp-uploader', async () => {
      initiateUpload.mockResolvedValue({ uploadId: 'u-1' })

      await startMigration({ hasUpload: () => false })

      expect(initiateUpload).toHaveBeenCalledWith({
        redirect: '/create-guidance/upload-guide/processing',
        s3Bucket: 'rpa-ai-guidance-hub-source-docs'
      })
    })
  })

  describe('getUploadOutcome', () => {
    test('returns NO_UPLOAD when the session has no upload', async () => {
      getGuideUpload.mockReturnValue(null)

      expect(await getUploadOutcome(request)).toEqual({ code: RESULTS.NO_UPLOAD })
      expect(getUploadStatus).not.toHaveBeenCalled()
    })

    test.each([
      ['initiated', initiated, RESULTS.UPLOAD_AVAILABLE],
      ['pending', pending, RESULTS.UPLOAD_PENDING],
      ['ready with a clean file', complete, RESULTS.UPLOAD_COMPLETE]
    ])('classifies a %s upload', async (_label, status, code) => {
      getGuideUpload.mockReturnValue({ activeUploadId: 'u-1', hasUpload: () => true })
      getUploadStatus.mockResolvedValue(status)

      const outcome = await getUploadOutcome(request)

      expect(outcome.code).toBe(code)
      expect(outcome.failure).toBeUndefined()
      expect(outcome.status).toBe(status)
    })

    test('reports a rejected file as failed with cdp-uploader\'s message', async () => {
      getGuideUpload.mockReturnValue({ activeUploadId: 'u-1', hasUpload: () => true })
      getUploadStatus.mockResolvedValue(rejected)

      const outcome = await getUploadOutcome(request)

      expect(outcome.code).toBe(RESULTS.UPLOAD_FAILED)
      expect(outcome.failure).toEqual({
        statusId: 'uploader:rejected',
        message: 'The selected file contains a virus'
      })
    })

    test('reports a ready upload with no file as failed rather than complete', async () => {
      getGuideUpload.mockReturnValue({ activeUploadId: 'u-1', hasUpload: () => true })
      getUploadStatus.mockResolvedValue(noFile)

      const outcome = await getUploadOutcome(request)

      expect(outcome.code).toBe(RESULTS.UPLOAD_FAILED)
      expect(outcome.failure.statusId).toBe('uploader:no-file')
    })

    test('reports an upload cdp-uploader no longer knows as failed', async () => {
      getGuideUpload.mockReturnValue({ activeUploadId: 'u-1', hasUpload: () => true })
      getUploadStatus.mockResolvedValue(null)

      const outcome = await getUploadOutcome(request)

      expect(outcome.code).toBe(RESULTS.UPLOAD_FAILED)
      expect(outcome.failure.statusId).toBe('uploader:missing')
    })
  })

  describe('getGuideUploadProgress', () => {
    beforeEach(() => {
      getGuideUpload.mockReturnValue({ activeUploadId: 'u-1', hasUpload: () => true, completedStepIds: [] })
    })

    test('reports scanning in progress', async () => {
      getUploadStatus.mockResolvedValue(pending)

      const progress = await getGuideUploadProgress(request)

      expect(progress).toEqual({
        statusId: 'uploader:pending',
        label: 'Scanning for viruses',
        percentage: 50,
        isComplete: false,
        isError: false,
        message: null
      })
      expect(getUploadStatus).toHaveBeenCalledWith('u-1')
    })

    test('reports completion once the file has scanned clean', async () => {
      getUploadStatus.mockResolvedValue(complete)

      const progress = await getGuideUploadProgress(request)

      expect(progress.statusId).toBe('uploader:complete')
      expect(progress.isComplete).toBe(true)
      expect(progress.percentage).toBe(100)
    })

    test('reports a rejected file with cdp-uploader\'s message', async () => {
      getUploadStatus.mockResolvedValue(rejected)

      const progress = await getGuideUploadProgress(request)

      expect(progress.statusId).toBe('uploader:rejected')
      expect(progress.isError).toBe(true)
      expect(progress.label).toBe('File rejected')
      expect(progress.message).toBe('The selected file contains a virus')
    })

    test('falls back to the step\'s own message when the failure has none', async () => {
      getUploadStatus.mockResolvedValue(noFile)

      const progress = await getGuideUploadProgress(request)

      expect(progress.statusId).toBe('uploader:no-file')
      expect(progress.message).toBe('Select a Word document to upload.')
    })

    test('reports a generic failure when cdp-uploader cannot be reached', async () => {
      getUploadStatus.mockRejectedValue(new Error('boom'))

      const progress = await getGuideUploadProgress(request)

      expect(progress.statusId).toBe('uploader:failed')
      expect(progress.isError).toBe(true)
      expect(progress.message).toBe('The selected file could not be checked. Upload it again.')
    })

    test('uses an already-fetched status instead of calling cdp-uploader again', async () => {
      const progress = await getGuideUploadProgress(request, { status: complete })

      expect(progress.isComplete).toBe(true)
      expect(getUploadStatus).not.toHaveBeenCalled()
    })

    test('persists newly completed steps to session', async () => {
      getUploadStatus.mockResolvedValue(complete)

      await getGuideUploadProgress(request)

      expect(setGuideUploadCompletedSteps).toHaveBeenCalledWith(request, ['scanning'])
    })

    test('does not persist or re-check steps already completed in session', async () => {
      getGuideUpload.mockReturnValue({ activeUploadId: 'u-1', hasUpload: () => true, completedStepIds: ['scanning'] })

      const progress = await getGuideUploadProgress(request)

      expect(progress.isComplete).toBe(true)
      expect(getUploadStatus).not.toHaveBeenCalled()
      expect(setGuideUploadCompletedSteps).not.toHaveBeenCalled()
    })

    test('does not persist anything while a step is still pending', async () => {
      getUploadStatus.mockResolvedValue(pending)

      await getGuideUploadProgress(request)

      expect(setGuideUploadCompletedSteps).not.toHaveBeenCalled()
    })
  })
})
