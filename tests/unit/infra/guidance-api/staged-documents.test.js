import { statusCodes } from '../../../../src/constants/status-codes.js'
import { guidanceApiClient } from '../../../../src/infra/guidance-api/client.js'
import {
  getStagedDocument
} from '../../../../src/infra/guidance-api/staged-documents.js'

describe('staged-documents infra', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  test('calls GET /guides/staging/{fileId} with 404 in expected statuses', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      data: {
        fileId: 'file-123',
        parsingStatus: 'complete'
      }
    }
    const requestSpy = vi.spyOn(guidanceApiClient, 'request')
      .mockResolvedValue(mockResponse)

    const result = await getStagedDocument('file-123')

    expect(requestSpy).toHaveBeenCalledWith('/guides/staging/file-123', {
      expected: [statusCodes.HTTP_STATUS_NOT_FOUND]
    })
    expect(result).toEqual(mockResponse)
  })

  test('encodes special characters in fileId parameter', async () => {
    const requestSpy = vi.spyOn(guidanceApiClient, 'request')
      .mockResolvedValue({ ok: true, status: 200, data: null })

    await getStagedDocument('file/with spaces&special')

    expect(requestSpy).toHaveBeenCalledWith(
      '/guides/staging/file%2Fwith%20spaces%26special',
      { expected: [statusCodes.HTTP_STATUS_NOT_FOUND] }
    )
  })
})
