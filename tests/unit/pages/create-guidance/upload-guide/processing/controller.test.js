import { statusCodes } from '../../../../../../src/constants/status-codes.js'

vi.mock('../../../../../../src/pages/create-guidance/session.js', () => ({
  getGuideUpload: vi.fn()
}))

vi.mock('../../../../../../src/pages/create-guidance/service.js', async () => {
  const { RESULTS } = await import('../../../../../../src/pages/create-guidance/service.js')
  return {
    RESULTS,
    getUploadOutcome: vi.fn(),
    getGuideUploadProgress: vi.fn()
  }
})

import { getGuideUpload } from '../../../../../../src/pages/create-guidance/session.js'
import {
  getUploadOutcome,
  getGuideUploadProgress,
  RESULTS
} from '../../../../../../src/pages/create-guidance/service.js'
import { getStatus, getStatusPage } from '../../../../../../src/pages/create-guidance/upload-guide/processing/controller.js'

const PROCESSING_VIEW = 'create-guidance/upload-guide/processing/page.njk'

const pendingProgress = {
  statusId: 'uploader:pending',
  label: 'Scanning for viruses',
  percentage: 50,
  isComplete: false,
  isError: false,
  message: null
}

describe('processingController', () => {
  let request, h, code

  beforeEach(() => {
    code = vi.fn()
    h = {
      view: vi.fn(() => ({ code })),
      redirect: vi.fn(() => ({ redirected: true })),
      response: vi.fn(() => ({ code }))
    }
    request = {}
    vi.clearAllMocks()
  })

  describe('getStatusPage', () => {
    test('redirects to the upload form when there is no session upload', async () => {
      getUploadOutcome.mockResolvedValue({ code: RESULTS.NO_UPLOAD })

      await getStatusPage(request, h)

      expect(h.redirect).toHaveBeenCalledWith('/create-guidance/upload-guide')
      expect(getGuideUploadProgress).not.toHaveBeenCalled()
    })

    test('redirects to the upload form if the upload handle has not been used yet', async () => {
      getUploadOutcome.mockResolvedValue({ code: RESULTS.UPLOAD_AVAILABLE })

      await getStatusPage(request, h)

      expect(h.redirect).toHaveBeenCalledWith('/create-guidance/upload-guide')
    })

    test('redirects straight to metadata when all steps are complete', async () => {
      getUploadOutcome.mockResolvedValue({ code: RESULTS.UPLOAD_COMPLETE, status: null })
      getGuideUploadProgress.mockResolvedValue({ isComplete: true })

      await getStatusPage(request, h)

      expect(h.redirect).toHaveBeenCalledWith('/create-guidance/upload-guide/metadata')
      expect(h.view).not.toHaveBeenCalled()
    })

    test('renders the processing view when scanning is complete but parsing is still in progress', async () => {
      const status = { uploadStatus: 'ready' }
      getUploadOutcome.mockResolvedValue({ code: RESULTS.UPLOAD_COMPLETE, status })
      getGuideUploadProgress.mockResolvedValue({
        ...pendingProgress,
        statusId: 'minimal-parse:in-progress',
        label: 'Parsing document',
        percentage: 50,
        isComplete: false
      })

      await getStatusPage(request, h)

      expect(h.view).toHaveBeenCalledWith(PROCESSING_VIEW, expect.objectContaining({
        label: 'Parsing document',
        percentage: 50,
        isError: false
      }))
      expect(h.redirect).not.toHaveBeenCalled()
    })

    test('renders the processing view with progress while the scan is pending', async () => {
      const status = { uploadStatus: 'pending' }
      getUploadOutcome.mockResolvedValue({ code: RESULTS.UPLOAD_PENDING, status })
      getGuideUploadProgress.mockResolvedValue(pendingProgress)

      await getStatusPage(request, h)

      expect(h.view).toHaveBeenCalledWith(PROCESSING_VIEW, expect.objectContaining({
        pollUrl: '/create-guidance/upload-guide/processing/status',
        redirectUrl: '/create-guidance/upload-guide/metadata',
        label: 'Scanning for viruses',
        percentage: 50,
        isError: false,
        pageTitle: 'Checking your file',
        page: 'upload processing'
      }))
      expect(code).toHaveBeenCalledWith(statusCodes.HTTP_STATUS_OK)
    })

    test('hands the status it already fetched to the progress check', async () => {
      const status = { uploadStatus: 'pending' }
      getUploadOutcome.mockResolvedValue({ code: RESULTS.UPLOAD_PENDING, status })
      getGuideUploadProgress.mockResolvedValue(pendingProgress)

      await getStatusPage(request, h)

      expect(getGuideUploadProgress).toHaveBeenCalledWith(request, { status })
    })

    test('renders the failure with its message when the upload failed', async () => {
      getUploadOutcome.mockResolvedValue({ code: RESULTS.UPLOAD_FAILED, status: null })
      getGuideUploadProgress.mockResolvedValue({
        ...pendingProgress,
        statusId: 'uploader:rejected',
        label: 'File rejected',
        isError: true,
        message: 'The selected file contains a virus'
      })

      await getStatusPage(request, h)

      expect(h.view).toHaveBeenCalledWith(PROCESSING_VIEW, expect.objectContaining({
        isError: true,
        errorMessage: 'The selected file contains a virus',
        retryUrl: '/create-guidance/upload-guide'
      }))
    })
  })

  describe('getStatus', () => {
    test('returns 400 when the session has no upload', async () => {
      getGuideUpload.mockReturnValue(null)

      await getStatus(request, h)

      expect(h.response).toHaveBeenCalledWith({ message: 'No active upload found' })
      expect(code).toHaveBeenCalledWith(statusCodes.HTTP_STATUS_BAD_REQUEST)
      expect(getGuideUploadProgress).not.toHaveBeenCalled()
    })

    test('returns the progress of the session upload as JSON', async () => {
      getGuideUpload.mockReturnValue({ hasUpload: () => true, activeUploadId: 'u-1' })
      getGuideUploadProgress.mockResolvedValue(pendingProgress)

      await getStatus(request, h)

      expect(getGuideUploadProgress).toHaveBeenCalledWith(request)
      expect(h.response).toHaveBeenCalledWith({
        percentage: 50,
        label: 'Scanning for viruses',
        message: null,
        isComplete: false,
        isError: false
      })
      expect(code).toHaveBeenCalledWith(statusCodes.HTTP_STATUS_OK)
    })

    test('includes the failure message when the upload failed', async () => {
      getGuideUpload.mockReturnValue({ hasUpload: () => true, activeUploadId: 'u-1' })
      getGuideUploadProgress.mockResolvedValue({
        ...pendingProgress,
        isError: true,
        label: 'File rejected',
        message: 'The selected file contains a virus'
      })

      await getStatus(request, h)

      expect(h.response).toHaveBeenCalledWith(expect.objectContaining({
        isError: true,
        message: 'The selected file contains a virus'
      }))
    })
  })
})
