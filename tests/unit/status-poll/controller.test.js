import { statusCodes } from '../../../src/constants/status-codes.js'

vi.mock('../../../src/pages/create-guidance/session.js', () => ({
  getGuideUpload: vi.fn()
}))

vi.mock('../../../src/services/uploader.js', () => ({
  getUploadStatus: vi.fn()
}))

import { getGuideUpload } from '../../../src/pages/create-guidance/session.js'
import { getUploadStatus } from '../../../src/services/uploader.js'
import { getStatus } from '../../../src/status-poll/controller.js'

describe('statusPollController', () => {
  let request, h, code

  beforeEach(() => {
    code = vi.fn()
    h = {
      response: vi.fn(() => ({ code }))
    }
    request = {
      params: {},
      query: {}
    }
    vi.clearAllMocks()
  })

  test('returns 400 when no upload id is present in params, query, or session', async () => {
    getGuideUpload.mockReturnValue(null)

    await getStatus(request, h)

    expect(h.response).toHaveBeenCalledWith({ message: 'No active upload found' })
    expect(code).toHaveBeenCalledWith(statusCodes.HTTP_STATUS_BAD_REQUEST)
  })

  test('returns 404 when upload status cannot be found', async () => {
    request.params.uploadId = 'u-123'
    getUploadStatus.mockResolvedValue(null)

    await getStatus(request, h)

    expect(getUploadStatus).toHaveBeenCalledWith('u-123')
    expect(h.response).toHaveBeenCalledWith({ message: 'Upload not found' })
    expect(code).toHaveBeenCalledWith(statusCodes.HTTP_STATUS_NOT_FOUND)
  })

  test('returns 200 with pending status when upload is in progress', async () => {
    request.params.uploadId = 'u-123'
    getUploadStatus.mockResolvedValue({
      uploadStatus: 'pending',
      isReady: false,
      hasRejectedFiles: false,
      files: []
    })

    await getStatus(request, h)

    expect(h.response).toHaveBeenCalledWith({
      uploadId: 'u-123',
      uploadStatus: 'pending',
      isReady: false,
      hasRejectedFiles: false,
      files: [],
      redirectUrl: null
    })
    expect(code).toHaveBeenCalledWith(statusCodes.HTTP_STATUS_OK)
  })

  test('returns 200 with ready status and redirectUrl when upload is complete', async () => {
    request.params.uploadId = 'u-123'
    getUploadStatus.mockResolvedValue({
      uploadStatus: 'ready',
      isReady: true,
      hasRejectedFiles: false,
      files: [{ fileStatus: 'complete' }]
    })

    await getStatus(request, h)

    expect(h.response).toHaveBeenCalledWith({
      uploadId: 'u-123',
      uploadStatus: 'ready',
      isReady: true,
      hasRejectedFiles: false,
      files: [{ fileStatus: 'complete' }],
      redirectUrl: '/create-guidance/metadata'
    })
    expect(code).toHaveBeenCalledWith(statusCodes.HTTP_STATUS_OK)
  })

  test('returns 200 with redirectUrl null when upload is ready but has rejected files', async () => {
    getGuideUpload.mockReturnValue({ activeUploadId: 'u-123' })
    getUploadStatus.mockResolvedValue({
      uploadStatus: 'ready',
      isReady: true,
      hasRejectedFiles: true,
      files: [{ fileStatus: 'rejected', error: { message: 'Virus detected' } }]
    })

    await getStatus(request, h)

    expect(h.response).toHaveBeenCalledWith({
      uploadId: 'u-123',
      uploadStatus: 'ready',
      isReady: true,
      hasRejectedFiles: true,
      files: [{ fileStatus: 'rejected', error: { message: 'Virus detected' } }],
      redirectUrl: null
    })
    expect(code).toHaveBeenCalledWith(statusCodes.HTTP_STATUS_OK)
  })
})
