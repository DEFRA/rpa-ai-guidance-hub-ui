import { statusCodes } from '../../../../../../src/constants/status-codes.js'
import * as session from '../../../../../../src/pages/create-guidance/session.js'
import * as progressModule from '../../../../../../src/pages/create-guidance/upload-guide/converting/progress.js'
import {
  getConvertingPage,
  getConvertingStatus
} from '../../../../../../src/pages/create-guidance/upload-guide/converting/controller.js'

const CONVERTING_VIEW = 'create-guidance/upload-guide/converting/page.njk'

function mockUpload () {
  const upload = {
    hasUpload: vi.fn(() => true),
    fileId: 'file-1',
    metadata: { guideTitle: 'A title' }
  }
  vi.spyOn(session, 'getGuideUpload').mockReturnValue(upload)
  return upload
}

function mockProgress (fields = {}) {
  return vi.spyOn(progressModule, 'getConversionProgress').mockResolvedValue({
    percentage: 50,
    label: 'Saving the document: 37 of 74 parts saved',
    isComplete: false,
    isError: false,
    message: null,
    detail: null,
    ...fields
  })
}

describe('converting controller', () => {
  let request, h, code

  beforeEach(() => {
    vi.restoreAllMocks()
    code = vi.fn()
    h = {
      view: vi.fn(() => ({ code })),
      redirect: vi.fn(),
      response: vi.fn(() => ({ code }))
    }
    request = { yar: { get: vi.fn(), clear: vi.fn(), flash: vi.fn() } }
  })

  describe('getConvertingPage', () => {
    test('sends the user to the upload form when there is no upload to convert', async () => {
      vi.spyOn(session, 'getGuideUpload').mockReturnValue(null)

      await getConvertingPage(request, h)

      expect(h.redirect).toHaveBeenCalledWith('/create-guidance/upload-guide')
    })

    test('shows the progress bar while the document is saving', async () => {
      mockUpload()
      mockProgress()

      await getConvertingPage(request, h)

      expect(h.view).toHaveBeenCalledWith(CONVERTING_VIEW, expect.objectContaining({
        percentage: 50,
        label: 'Saving the document: 37 of 74 parts saved',
        pollUrl: '/create-guidance/upload-guide/converting/status'
      }))
      expect(code).toHaveBeenCalledWith(statusCodes.HTTP_STATUS_OK)
    })

    test('when the save is complete, confirms the guide on the Guidance converted page and starts the next guide afresh', async () => {
      mockUpload()
      mockProgress({ percentage: 100, isComplete: true })
      const flashSpy = vi.spyOn(session, 'flashConvertedGuide').mockReturnValue()
      const clearSpy = vi.spyOn(session, 'clearGuideUpload').mockReturnValue()

      await getConvertingPage(request, h)

      expect(flashSpy).toHaveBeenCalledWith(request, 'A title')
      expect(clearSpy).toHaveBeenCalledWith(request)
      expect(h.redirect).toHaveBeenCalledWith('/create-guidance/upload-guide/converted')
    })

    test('shows the error and keeps the upload when the save fails', async () => {
      mockUpload()
      mockProgress({ isError: true, message: 'The document could not be converted', detail: 'Go back' })
      const clearSpy = vi.spyOn(session, 'clearGuideUpload').mockReturnValue()

      await getConvertingPage(request, h)

      expect(h.view).toHaveBeenCalledWith(CONVERTING_VIEW, expect.objectContaining({
        isError: true,
        errorMessage: 'The document could not be converted',
        pageTitle: 'Error: Converting your document'
      }))
      expect(clearSpy).not.toHaveBeenCalled()
    })
  })

  describe('getConvertingStatus', () => {
    test('answers the save\'s progress for the page to poll', async () => {
      mockUpload()
      mockProgress()

      await getConvertingStatus(request, h)

      expect(h.response).toHaveBeenCalledWith({
        percentage: 50,
        label: 'Saving the document: 37 of 74 parts saved',
        message: null,
        detail: null,
        isComplete: false,
        isError: false
      })
      expect(code).toHaveBeenCalledWith(statusCodes.HTTP_STATUS_OK)
    })

    test('refuses when there is no upload in the session', async () => {
      vi.spyOn(session, 'getGuideUpload').mockReturnValue(null)

      await getConvertingStatus(request, h)

      expect(code).toHaveBeenCalledWith(statusCodes.HTTP_STATUS_BAD_REQUEST)
    })
  })
})
