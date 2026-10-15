import { statusCodes } from '../../../../src/constants/status-codes.js'
import { cdpUploaderClient } from '../../../../src/infra/cdp-uploader/client.js'
import { initiateUpload, getUploadStatus } from '../../../../src/infra/cdp-uploader/uploads.js'

vi.mock('../../../../src/infra/cdp-uploader/client.js', () => ({
  cdpUploaderClient: { request: vi.fn() }
}))

describe('cdp-uploader uploads API', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  describe('initiateUpload', () => {
    test('POSTs the initiate request', async () => {
      const initiateRequest = {
        redirect: '/create-guidance/metadata',
        s3Bucket: 'rpa-ai-guidance-hub-source-docs'
      }
      cdpUploaderClient.request.mockResolvedValue({ ok: true, status: statusCodes.HTTP_STATUS_OK, data: {} })

      await initiateUpload(initiateRequest)

      expect(cdpUploaderClient.request).toHaveBeenCalledWith('/initiate', {
        method: 'POST',
        body: initiateRequest
      })
    })

    test('returns the client response', async () => {
      const response = { ok: true, status: statusCodes.HTTP_STATUS_OK, data: { uploadId: 'u-1' } }
      cdpUploaderClient.request.mockResolvedValue(response)

      const result = await initiateUpload({ s3Bucket: 'bucket' })

      expect(result).toEqual(response)
    })
  })

  describe('getUploadStatus', () => {
    test('GETs the upload status, treating 404 as an expected status', async () => {
      cdpUploaderClient.request.mockResolvedValue({ ok: false, status: statusCodes.HTTP_STATUS_NOT_FOUND, data: null })

      await getUploadStatus('u-1')

      expect(cdpUploaderClient.request).toHaveBeenCalledWith('/status/u-1', {
        method: 'GET',
        query: undefined,
        expected: [statusCodes.HTTP_STATUS_NOT_FOUND]
      })
    })

    test('encodes the upload id in the path', async () => {
      cdpUploaderClient.request.mockResolvedValue({ ok: true, status: statusCodes.HTTP_STATUS_OK, data: {} })

      await getUploadStatus('u/1 2')

      expect(cdpUploaderClient.request).toHaveBeenCalledWith('/status/u%2F1%202', expect.any(Object))
    })

    test('adds debug=true to the query when requested', async () => {
      cdpUploaderClient.request.mockResolvedValue({ ok: true, status: statusCodes.HTTP_STATUS_OK, data: {} })

      await getUploadStatus('u-1', { debug: true })

      expect(cdpUploaderClient.request).toHaveBeenCalledWith('/status/u-1', expect.objectContaining({
        query: { debug: 'true' }
      }))
    })
  })
})
