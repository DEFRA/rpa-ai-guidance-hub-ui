import { statusCodes } from '../../../../../../src/constants/status-codes.js'
import * as session from '../../../../../../src/pages/create-guidance/session.js'
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

  test('says conversion is taking a long time, offering to check again', async () => {
    vi.spyOn(session, 'getGuideUpload').mockReturnValue({
      hasUpload: () => true,
      fileId: 'file-1'
    })

    await getConverting(request, h)

    expect(h.view).toHaveBeenCalledWith(CONVERTING_VIEW, expect.objectContaining({
      pageTitle: 'Converting this document is taking a long time',
      checkAgainUrl: '/create-guidance/upload-guide/converting'
    }))
    expect(code).toHaveBeenCalledWith(statusCodes.HTTP_STATUS_OK)
  })
})
