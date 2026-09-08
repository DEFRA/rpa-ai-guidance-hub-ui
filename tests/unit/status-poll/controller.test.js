import { statusCodes } from '../../../src/constants/status-codes.js'

vi.mock('../../../src/pages/create-guidance/session.js', () => ({
  getGuideUpload: vi.fn()
}))

vi.mock('../../../src/pages/create-guidance/service.js', () => ({
  getGuideUploadProgress: vi.fn()
}))

import { getGuideUpload } from '../../../src/pages/create-guidance/session.js'
import { getGuideUploadProgress } from '../../../src/pages/create-guidance/service.js'
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

  test('returns 200 with progress when upload is in progress', async () => {
    request.params.uploadId = 'u-123'
    getGuideUploadProgress.mockResolvedValue({
      statusId: 'uploader:pending',
      label: 'Scanning for viruses',
      percentage: 50,
      isComplete: false,
      isError: false
    })

    await getStatus(request, h)

    expect(h.response).toHaveBeenCalledWith({
      percentage: 50,
      label: 'Scanning for viruses',
      isComplete: false,
      isError: false
    })
    expect(code).toHaveBeenCalledWith(statusCodes.HTTP_STATUS_OK)
  })

  test('returns 200 with complete status when upload is ready', async () => {
    request.params.uploadId = 'u-123'
    getGuideUploadProgress.mockResolvedValue({
      statusId: 'uploader:pending',
      label: 'Guide ready',
      percentage: 100,
      isComplete: true,
      isError: false
    })

    await getStatus(request, h)

    expect(h.response).toHaveBeenCalledWith({
      percentage: 100,
      label: 'Guide ready',
      isComplete: true,
      isError: false
    })
    expect(code).toHaveBeenCalledWith(statusCodes.HTTP_STATUS_OK)
  })

  test('uses session upload id when no param is provided', async () => {
    getGuideUpload.mockReturnValue({ activeUploadId: 'u-123' })
    getGuideUploadProgress.mockResolvedValue({
      statusId: 'uploader:pending',
      label: 'Scanning for viruses',
      percentage: 50,
      isComplete: false,
      isError: false
    })

    await getStatus(request, h)

    expect(getGuideUploadProgress).toHaveBeenCalledWith(request, 'u-123')
  })

  test('returns error state when upload fails', async () => {
    request.params.uploadId = 'u-123'
    getGuideUploadProgress.mockResolvedValue({
      statusId: 'uploader:failed',
      label: 'Scan failed',
      percentage: 50,
      isComplete: false,
      isError: true
    })

    await getStatus(request, h)

    expect(h.response).toHaveBeenCalledWith({
      percentage: 50,
      label: 'Scan failed',
      isComplete: false,
      isError: true
    })
    expect(code).toHaveBeenCalledWith(statusCodes.HTTP_STATUS_OK)
  })
})
