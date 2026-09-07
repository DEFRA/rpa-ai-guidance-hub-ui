import { statusCodes } from '../../../../../src/constants/status-codes.js'

vi.mock('../../../../../src/pages/create-guidance/service.js', async () => {
  const { RESULTS } = await import('../../../../../src/pages/create-guidance/service.js')
  return {
    RESULTS,
    startMigration: vi.fn()
  }
})

vi.mock('../../../../../src/pages/create-guidance/session.js', () => ({
  getGuideUpload: vi.fn(),
  createGuideUpload: vi.fn(),
  addGuideUpload: vi.fn()
}))

import { startMigration } from '../../../../../src/pages/create-guidance/service.js'
import { getGuideUpload, createGuideUpload, addGuideUpload } from '../../../../../src/pages/create-guidance/session.js'
import { getUploadForm } from '../../../../../src/pages/create-guidance/upload-guide/controller.js'

const UPLOAD_GUIDANCE_VIEW = 'create-guidance/upload-guide/page.njk'

describe('getUploadForm', () => {
  let request, h, code

  beforeEach(() => {
    request = { yar: { flash: vi.fn() } }
    code = vi.fn()
    h = {
      view: vi.fn(() => ({ code })),
      redirect: vi.fn(() => ({ redirected: true }))
    }
  })

  describe('when no migration has been started', () => {
    beforeEach(() => {
      getGuideUpload.mockReturnValue(null)
      createGuideUpload.mockReturnValue({ activeUploadId: null })
      startMigration.mockResolvedValue({ code: 'migrationStarted', uploadId: 'new-upload-id' })
    })

    test('creates a new guide upload session', async () => {
      await getUploadForm(request, h)

      expect(createGuideUpload).toHaveBeenCalledWith(request)
    })

    test('records the newly started upload in session', async () => {
      await getUploadForm(request, h)

      expect(addGuideUpload).toHaveBeenCalledWith(request, 'new-upload-id')
    })

    test('renders the upload form with a view model built from the new upload', async () => {
      await getUploadForm(request, h)

      expect(h.view).toHaveBeenCalledWith(UPLOAD_GUIDANCE_VIEW, expect.objectContaining({
        page: 'upload single guidance document',
        pageTitle: 'Upload a single guidance document',
        uploadUrl: expect.stringContaining('/new-upload-id')
      }))
    })

    test('responds with 200', async () => {
      await getUploadForm(request, h)

      expect(code).toHaveBeenCalledWith(statusCodes.HTTP_STATUS_OK)
    })
  })

  describe('when the upload has already been used', () => {
    beforeEach(() => {
      getGuideUpload.mockReturnValue({ activeUploadId: 'u-1' })
      startMigration.mockResolvedValue({ code: 'uploadExpended' })
    })

    test('flashes a notification explaining why', async () => {
      await getUploadForm(request, h)

      expect(request.yar.flash).toHaveBeenCalledWith('uploadNotification', 'You have already uploaded a document for this guide')
    })

    test('redirects to metadata', async () => {
      const result = await getUploadForm(request, h)

      expect(h.redirect).toHaveBeenCalledWith('/create-guidance/metadata')
      expect(result).toEqual(h.redirect())
    })

    test('does not record a new upload in session', async () => {
      await getUploadForm(request, h)

      expect(addGuideUpload).not.toHaveBeenCalled()
    })
  })

  describe('when an upload is available to fill in', () => {
    beforeEach(() => {
      getGuideUpload.mockReturnValue({ activeUploadId: 'u-1' })
      startMigration.mockResolvedValue({ code: 'uploadAvailable' })
    })

    test('does not create or record a new upload in session', async () => {
      await getUploadForm(request, h)

      expect(createGuideUpload).not.toHaveBeenCalled()
      expect(addGuideUpload).not.toHaveBeenCalled()
    })

    test('renders the upload form with a view model built from the active upload', async () => {
      await getUploadForm(request, h)

      expect(h.view).toHaveBeenCalledWith(UPLOAD_GUIDANCE_VIEW, expect.objectContaining({
        page: 'upload single guidance document',
        pageTitle: 'Upload a single guidance document',
        uploadUrl: expect.stringContaining('/u-1')
      }))
    })

    test('responds with 200', async () => {
      await getUploadForm(request, h)

      expect(code).toHaveBeenCalledWith(statusCodes.HTTP_STATUS_OK)
    })
  })
})
