vi.mock('../../../../../../src/pages/create-guidance/session.js', () => ({
  getGuideUpload: vi.fn()
}))

vi.mock('../../../../../../src/pages/create-guidance/service.js', () => ({
  checkUploadHandleStatus: vi.fn(),
  getGuideUploadProgress: vi.fn(),
  RESULTS: {
    MIGRATION_STARTED: 'migrationStarted',
    NO_UPLOAD: 'noUpload',
    UPLOAD_AVAILABLE: 'uploadAvailable',
    UPLOAD_EXPENDED: 'uploadExpended'
  }
}))

import { getGuideUpload } from '../../../../../../src/pages/create-guidance/session.js'
import {
  checkUploadHandleStatus,
  getGuideUploadProgress,
  RESULTS
} from '../../../../../../src/pages/create-guidance/service.js'
import { getStatusPage } from '../../../../../../src/pages/create-guidance/upload-guide/processing/controller.js'

const PROCESSING_VIEW = 'create-guidance/upload-guide/processing/page.njk'

describe('processingController', () => {
  let request, h, code

  beforeEach(() => {
    code = vi.fn()
    h = {
      view: vi.fn(() => ({ code })),
      redirect: vi.fn(() => ({ redirected: true }))
    }
    request = {}
    vi.clearAllMocks()
  })

  test('redirects to the upload form when there is no session upload', async () => {
    getGuideUpload.mockReturnValue(null)

    await getStatusPage(request, h)

    expect(h.redirect).toHaveBeenCalledWith('/create-guidance/upload-guide')
  })

  test('redirects to upload form if the upload handle has not been used yet', async () => {
    getGuideUpload.mockReturnValue({ hasUpload: () => true, activeUploadId: 'u-1' })
    checkUploadHandleStatus.mockResolvedValue({ code: RESULTS.UPLOAD_AVAILABLE })

    await getStatusPage(request, h)

    expect(h.redirect).toHaveBeenCalledWith('/create-guidance/upload-guide')
  })

  test('renders the processing view with a poll URL and initial progress when upload handle has been used', async () => {
    getGuideUpload.mockReturnValue({ hasUpload: () => true, activeUploadId: 'u-1' })
    checkUploadHandleStatus.mockResolvedValue({ code: RESULTS.UPLOAD_EXPENDED })
    getGuideUploadProgress.mockResolvedValue({
      statusId: 'initial',
      label: 'Checking your file',
      percentage: 0,
      isComplete: false,
      isError: false
    })

    await getStatusPage(request, h)

    expect(h.view).toHaveBeenCalledWith(PROCESSING_VIEW, expect.objectContaining({
      pollUrl: '/status-poll/u-1',
      redirectUrl: '/create-guidance/metadata',
      label: 'Checking your file',
      percentage: 0
    }))
  })

  test('sets the page title and page property', async () => {
    getGuideUpload.mockReturnValue({ hasUpload: () => true, activeUploadId: 'u-1' })
    checkUploadHandleStatus.mockResolvedValue({ code: RESULTS.UPLOAD_EXPENDED })
    getGuideUploadProgress.mockResolvedValue({
      statusId: 'initial',
      label: 'Checking your file',
      percentage: 0,
      isComplete: false,
      isError: false
    })

    await getStatusPage(request, h)

    expect(h.view).toHaveBeenCalledWith(PROCESSING_VIEW, expect.objectContaining({
      pageTitle: 'Checking your file',
      page: 'upload processing'
    }))
  })
})
