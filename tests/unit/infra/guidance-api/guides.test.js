import { statusCodes } from '../../../../src/constants/status-codes.js'

import { guidanceApiClient } from '../../../../src/infra/guidance-api/client.js'
import * as guideApi from '../../../../src/infra/guidance-api/guides.js'

vi.mock('../../../../src/infra/guidance-api/client.js', () => ({
  guidanceApiClient: { request: vi.fn() }
}))

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
    vi.resetAllMocks()
  })

  test('calls POST /guides with the new guide as its body, expecting 404 and 409, waiting without limit', async () => {
    guidanceApiClient.request.mockResolvedValue({ ok: true, status: 201, data: {} })

    await guideApi.createGuide(newGuide)

    expect(guidanceApiClient.request).toHaveBeenCalledWith('/guides', {
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
    guidanceApiClient.request.mockResolvedValue(mockResponse)

    const result = await guideApi.createGuide(newGuide)

    expect(result).toEqual(mockResponse)
  })

  describe('listGuides', () => {
    test('calls GET /guides with no filters by default', async () => {
      guidanceApiClient.request.mockResolvedValue({ ok: true, status: 200, data: {} })

      await guideApi.listGuides()

      expect(guidanceApiClient.request).toHaveBeenCalledWith('/guides', {
        query: {
          limit: undefined,
          cursor: undefined,
          scheme: undefined,
          system: undefined,
          audience: undefined,
          guidance_type: undefined
        }
      })
    })

    test('names the filters as the API does', async () => {
      guidanceApiClient.request.mockResolvedValue({ ok: true, status: 200, data: {} })

      await guideApi.listGuides({
        limit: 10,
        cursor: 'c1',
        schemes: ['sfi'],
        systems: ['crm'],
        audiences: ['processor'],
        guidanceTypes: ['how-to']
      })

      expect(guidanceApiClient.request).toHaveBeenCalledWith('/guides', {
        query: {
          limit: 10,
          cursor: 'c1',
          scheme: ['sfi'],
          system: ['crm'],
          audience: ['processor'],
          guidance_type: ['how-to']
        }
      })
    })
  })

  describe('getGuide', () => {
    test('calls GET /guides/{id}, expecting 404', async () => {
      guidanceApiClient.request.mockResolvedValue({ ok: true, status: 200, data: {} })

      await guideApi.getGuide('guide 1')

      expect(guidanceApiClient.request).toHaveBeenCalledWith('/guides/guide%201', {
        expected: [statusCodes.HTTP_STATUS_NOT_FOUND]
      })
    })
  })

  describe('getGuideContent', () => {
    test('calls GET /guides/{id}/content reading text, expecting 404', async () => {
      guidanceApiClient.request.mockResolvedValue({ ok: true, status: 200, data: '# Title' })

      await guideApi.getGuideContent('guide-1')

      expect(guidanceApiClient.request).toHaveBeenCalledWith('/guides/guide-1/content', {
        expected: [statusCodes.HTTP_STATUS_NOT_FOUND],
        responseType: 'text'
      })
    })
  })

  describe('getGuideAsset', () => {
    test('calls GET /guides/{id}/assets/{name} reading a buffer, expecting 404', async () => {
      guidanceApiClient.request.mockResolvedValue({ ok: true, status: 200, data: Buffer.from('') })

      await guideApi.getGuideAsset('guide-1', 'abc123.png')

      expect(guidanceApiClient.request).toHaveBeenCalledWith('/guides/guide-1/assets/abc123.png', {
        expected: [statusCodes.HTTP_STATUS_NOT_FOUND],
        responseType: 'buffer'
      })
    })
  })
})
