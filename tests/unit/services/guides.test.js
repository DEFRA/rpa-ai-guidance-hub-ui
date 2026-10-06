import { statusCodes } from '../../../src/constants/status-codes.js'
import * as guidesApi from '../../../src/infra/guidance-api/guides.js'
import { createGuide, RESULTS } from '../../../src/services/guides.js'
import * as stagedDocumentsService from '../../../src/services/staged-documents.js'

const guide = {
  uploadId: 'upload-1',
  fileId: 'file-1',
  metadata: { guideTitle: 'A title' },
  user: {
    id: 'user-1',
    displayName: 'A User',
    email: 'a.user@example.com'
  }
}

function mockApiResponse (status) {
  return vi.spyOn(guidesApi, 'createGuide').mockResolvedValue({
    ok: status < statusCodes.HTTP_STATUS_BAD_REQUEST,
    status,
    data: {}
  })
}

describe('guides service', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  test('sends the upload, its answers and who made it to the API', async () => {
    const createGuideSpy = mockApiResponse(statusCodes.HTTP_STATUS_CREATED)

    await createGuide(guide)

    expect(createGuideSpy).toHaveBeenCalledWith({
      source: { uploadId: 'upload-1', fileId: 'file-1' },
      metadata: { guideTitle: 'A title' },
      createdBy: { id: 'user-1', displayName: 'A User' }
    })
  })

  test.each([
    statusCodes.HTTP_STATUS_CREATED,
    statusCodes.HTTP_STATUS_OK
  ])('reports the guide created when the API answers %i', async (status) => {
    mockApiResponse(status)

    const result = await createGuide(guide)

    expect(result).toEqual({ code: RESULTS.GUIDE_CREATED })
  })

  test('reports the upload expired when the API has no staged file for it', async () => {
    mockApiResponse(statusCodes.HTTP_STATUS_NOT_FOUND)

    const result = await createGuide(guide)

    expect(result).toEqual({ code: RESULTS.UPLOAD_EXPIRED })
  })

  test('reports the parse failed when the API refuses an upload whose parse failed', async () => {
    mockApiResponse(statusCodes.HTTP_STATUS_CONFLICT)
    vi.spyOn(stagedDocumentsService, 'getStagedDocumentById')
      .mockResolvedValue({ fileId: 'file-1', parsingStatus: 'failed' })

    const result = await createGuide(guide)

    expect(result).toEqual({ code: RESULTS.PARSE_FAILED })
  })

  test.each([
    'pending',
    'in_progress'
  ])('reports the parse unfinished when the API refuses an upload whose parse is %s', async (parsingStatus) => {
    mockApiResponse(statusCodes.HTTP_STATUS_CONFLICT)
    vi.spyOn(stagedDocumentsService, 'getStagedDocumentById')
      .mockResolvedValue({ fileId: 'file-1', parsingStatus })

    const result = await createGuide(guide)

    expect(result).toEqual({ code: RESULTS.PARSE_PENDING })
  })

  test('reports the upload expired when its staged file goes after the API refuses it as unparsed', async () => {
    mockApiResponse(statusCodes.HTTP_STATUS_CONFLICT)
    vi.spyOn(stagedDocumentsService, 'getStagedDocumentById').mockResolvedValue(null)

    const result = await createGuide(guide)

    expect(result).toEqual({ code: RESULTS.UPLOAD_EXPIRED })
  })
})
