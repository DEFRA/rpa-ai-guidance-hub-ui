import { statusCodes } from '../../../../../../../src/constants/status-codes.js'
import * as session from '../../../../../../../src/pages/create-guidance/session.js'
import * as referenceDataService from '../../../../../../../src/services/reference-data.js'
import { getCheckAnswers } from '../../../../../../../src/pages/create-guidance/upload-guide/metadata/check-answers/controller.js'

const CHECK_ANSWERS_VIEW = 'create-guidance/upload-guide/metadata/check-answers/page.njk'

function mockUpload (metadata) {
  vi.spyOn(session, 'getGuideUpload').mockReturnValue({
    hasUpload: vi.fn(() => true),
    activeUploadId: 'test-upload-id',
    metadata
  })
}

describe('upload-guide metadata check-answers controller', () => {
  let request, h, code

  beforeEach(() => {
    vi.restoreAllMocks()
    code = vi.fn()
    h = { view: vi.fn(() => ({ code })), redirect: vi.fn() }
    request = { yar: { get: vi.fn(() => null) } }
  })

  test('redirects to the upload form if there is no active upload', async () => {
    await getCheckAnswers(request, h)

    expect(h.redirect).toHaveBeenCalledWith('/create-guidance/upload-guide')
  })

  test('redirects to screen 1 if its answers are missing', async () => {
    mockUpload(null)

    await getCheckAnswers(request, h)

    expect(h.redirect).toHaveBeenCalledWith('/create-guidance/upload-guide/metadata')
  })

  test('redirects to screen 2 if its answers are missing', async () => {
    mockUpload({ guideTitle: 'A title' })

    await getCheckAnswers(request, h)

    expect(h.redirect).toHaveBeenCalledWith('/create-guidance/upload-guide/metadata/purpose')
  })

  test('renders the summary with labelled answers', async () => {
    mockUpload({ guideTitle: 'A title', schemes: ['sfi'], owner: 'owner@example.com', systems: ['crm'], audience: ['processor'] })
    vi.spyOn(referenceDataService, 'getSchemes').mockResolvedValue([{ value: 'sfi', label: 'SFI' }])
    vi.spyOn(referenceDataService, 'getSystems').mockResolvedValue([{ value: 'crm', label: 'CRM' }])
    vi.spyOn(referenceDataService, 'getAudiences').mockResolvedValue([{ value: 'processor', label: 'Processor' }])

    await getCheckAnswers(request, h)

    expect(h.view).toHaveBeenCalledWith(CHECK_ANSWERS_VIEW, expect.objectContaining({
      rows: expect.arrayContaining([
        expect.objectContaining({ key: 'Guidance title', value: 'A title' }),
        expect.objectContaining({ key: 'Schemes', values: ['SFI'] }),
        expect.objectContaining({ key: 'Systems', values: ['CRM'] }),
        expect.objectContaining({ key: 'Audience', values: ['Processor'] })
      ])
    }))
    expect(code).toHaveBeenCalledWith(statusCodes.HTTP_STATUS_OK)
  })
})
