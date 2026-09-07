vi.mock('../../../../src/services/uploader.js', () => ({
  getUploadStatus: vi.fn(),
  initiateUpload: vi.fn()
}))

import { getUploadStatus, initiateUpload } from '../../../../src/services/uploader.js'
import { RESULTS, startMigration } from '../../../../src/pages/create-guidance/service.js'

describe('create-guidance service', () => {
  beforeEach(() => {
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
})
