import { statusCodes } from '../../../../../../src/constants/status-codes.js'
import * as session from '../../../../../../src/pages/create-guidance/session.js'
import { getConverted } from '../../../../../../src/pages/create-guidance/upload-guide/converted/controller.js'

const CONVERTED_VIEW = 'create-guidance/upload-guide/converted/page.njk'

describe('converted controller', () => {
  let h, code
  const request = {}

  beforeEach(() => {
    vi.restoreAllMocks()
    code = vi.fn()
    h = {
      view: vi.fn(() => ({ code })),
      redirect: vi.fn()
    }
  })

  test('confirms the guide just converted, by its title', () => {
    vi.spyOn(session, 'takeConvertedGuide').mockReturnValue({ guideTitle: 'Converted Guide' })

    getConverted(request, h)

    expect(h.view).toHaveBeenCalledWith(CONVERTED_VIEW, expect.objectContaining({
      guideTitle: 'Converted Guide',
      pageTitle: 'Guidance converted'
    }))
    expect(code).toHaveBeenCalledWith(statusCodes.HTTP_STATUS_OK)
  })

  test('goes to the hub when nothing has just been converted', () => {
    vi.spyOn(session, 'takeConvertedGuide').mockReturnValue(null)

    getConverted(request, h)

    expect(h.redirect).toHaveBeenCalledWith('/hub')
    expect(h.view).not.toHaveBeenCalled()
  })
})
