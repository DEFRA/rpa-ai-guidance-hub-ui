import { statusCodes } from '../../../../../../src/constants/status-codes.js'
import * as session from '../../../../../../src/pages/create-guidance/session.js'
import * as stagedDocumentsService from '../../../../../../src/services/staged-documents.js'
import {
  getConverting
} from '../../../../../../src/pages/create-guidance/upload-guide/converting/controller.js'

const CONVERTING_VIEW = 'create-guidance/upload-guide/converting/page.njk'

describe('upload-guide converting controller', () => {
  let request, h, code

  beforeEach(() => {
    vi.restoreAllMocks()
    code = vi.fn()
    h = {
      view: vi.fn(() => ({ code })),
      redirect: vi.fn()
    }
    request = { yar: { get: vi.fn(() => null) } }
  })

  test('redirects to the upload form if there is no active upload', async () => {
    await getConverting(request, h)

    expect(h.redirect).toHaveBeenCalledWith('/create-guidance/upload-guide')
  })

  test('goes on to the hub once the conversion has been committed', async () => {
    vi.spyOn(session, 'getGuideUpload').mockReturnValue({
      hasUpload: () => true,
      fileId: 'file-1'
    })
    vi.spyOn(stagedDocumentsService, 'getStagedDocumentById').mockResolvedValue({
      fileId: 'file-1',
      documentId: 'document-1',
      promotedAt: '2026-10-06T11:00:00Z'
    })

    await getConverting(request, h)

    expect(h.redirect).toHaveBeenCalledWith('/hub')
  })

  test('says conversion is taking a long time, offering to check again', async () => {
    vi.spyOn(session, 'getGuideUpload').mockReturnValue({
      hasUpload: () => true,
      fileId: 'file-1'
    })
    vi.spyOn(stagedDocumentsService, 'getStagedDocumentById').mockResolvedValue({
      fileId: 'file-1',
      documentId: 'document-1',
      promotedAt: null
    })

    await getConverting(request, h)

    expect(h.view).toHaveBeenCalledWith(CONVERTING_VIEW, expect.objectContaining({
      pageTitle: 'Converting this document is taking a long time',
      checkAgainUrl: '/create-guidance/upload-guide/converting'
    }))
    expect(code).toHaveBeenCalledWith(statusCodes.HTTP_STATUS_OK)
  })
})
