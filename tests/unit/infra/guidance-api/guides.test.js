import { statusCodes } from '../../../../src/constants/status-codes.js'
import { guidanceApiClient } from '../../../../src/infra/guidance-api/client.js'
import { createGuide } from '../../../../src/infra/guidance-api/guides.js'

const newGuide = {
  source: {
    uploadId: 'upload-123',
    fileId: 'file-123',
    filename: 'guide.docx'
  },
  metadata: {
    guideTitle: 'Claiming the SFI payment'
  },
  createdBy: {
    id: 'user-123',
    displayName: 'A User'
  }
}

describe('guides infra', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  test('calls POST /guides with the new guide as its body, expecting 404 and 409, waiting without limit', async () => {
    const requestSpy = vi.spyOn(guidanceApiClient, 'request')
      .mockResolvedValue({ ok: true, status: 201, data: {} })

    await createGuide(newGuide)

    expect(requestSpy).toHaveBeenCalledWith('/guides', {
      method: 'POST',
      body: newGuide,
      expected: [
        statusCodes.HTTP_STATUS_NOT_FOUND,
        statusCodes.HTTP_STATUS_CONFLICT
      ],
      timeout: null
    })
  })

  test('returns the client\'s result', async () => {
    const mockResponse = {
      ok: true,
      status: 201,
      data: { id: 'document-123', versions: [{ id: 'version-123' }] }
    }
    vi.spyOn(guidanceApiClient, 'request').mockResolvedValue(mockResponse)

    const result = await createGuide(newGuide)

    expect(result).toEqual(mockResponse)
  })
})
