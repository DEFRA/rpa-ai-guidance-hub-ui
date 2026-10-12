import { statusCodes } from '../../../src/constants/status-codes.js'
import * as guidesApi from '../../../src/infra/guidance-api/guides.js'
import {
  createGuide,
  getGuideAsset,
  getGuideById,
  getGuideContent,
  getGuideVersions,
  listGuides,
  RESULTS
} from '../../../src/services/guides.js'
import {
  guidePageResponse,
  guideResponse,
  guideSummaryResponse,
  versionResponse
} from '../../fixtures/guidance-api.js'
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

  test('lets any other failure through', async () => {
    const failure = new Error('connection refused')
    vi.spyOn(guidesApi, 'createGuide').mockRejectedValue(failure)

    await expect(createGuide(guide)).rejects.toBe(failure)
  })
})

const NOT_FOUND = { ok: false, status: statusCodes.HTTP_STATUS_NOT_FOUND, data: null }

describe('guides service: reading', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('listGuides', () => {
    test('shapes each guide and passes the cursor on', async () => {
      const spy = vi.spyOn(guidesApi, 'listGuides').mockResolvedValue({
        ok: true,
        status: 200,
        data: guidePageResponse({ nextCursor: 'next-1' })
      })

      const result = await listGuides({ limit: 5 })

      expect(spy).toHaveBeenCalledWith({ limit: 5 })
      expect(result).toEqual({
        guides: [{
          id: 'guide-1',
          title: 'Claiming the SFI payment',
          owner: 'owner@example.com',
          schemes: ['Sustainable Farming Incentive (SFI)'],
          systems: ['CRM'],
          audience: ['Processor'],
          lastUpdated: '2026-10-06T08:00:00Z'
        }],
        nextCursor: 'next-1'
      })
    })

    test('falls back to the authored title and empty lists for a guide with no version or answers', async () => {
      vi.spyOn(guidesApi, 'listGuides').mockResolvedValue({
        ok: true,
        status: 200,
        data: guidePageResponse({
          items: [guideSummaryResponse({
            latestVersion: null,
            metadata: { guideTitle: 'Authored title' }
          })]
        })
      })

      const { guides } = await listGuides()

      expect(guides[0]).toMatchObject({
        title: 'Authored title',
        owner: null,
        schemes: [],
        systems: [],
        audience: [],
        lastUpdated: null
      })
    })

    test('lets a failure through', async () => {
      const failure = new Error('connection refused')
      vi.spyOn(guidesApi, 'listGuides').mockRejectedValue(failure)

      await expect(listGuides()).rejects.toBe(failure)
    })
  })

  describe('getGuideById', () => {
    test('shapes the guide with its latest version first', async () => {
      const older = versionResponse({ id: 'version-0', title: 'Old', createdAt: '2026-09-01T00:00:00Z' })
      vi.spyOn(guidesApi, 'getGuide').mockResolvedValue({
        ok: true,
        status: 200,
        data: guideResponse({ versions: [versionResponse(), older] })
      })

      const guide = await getGuideById('guide-1')

      expect(guide).toMatchObject({
        id: 'guide-1',
        title: 'Claiming the SFI payment',
        lastUpdated: '2026-10-06T08:00:00Z',
        latestVersion: { id: 'version-1' }
      })
      expect(guide.versions.map(version => version.id)).toEqual(['version-1', 'version-0'])
      expect(guide.versions[0]).not.toHaveProperty('contentUrl')
    })

    test('has no latest version for a guide without versions', async () => {
      vi.spyOn(guidesApi, 'getGuide').mockResolvedValue({
        ok: true,
        status: 200,
        data: guideResponse({ versions: [] })
      })

      expect(await getGuideById('guide-1')).toMatchObject({
        title: 'Authored title',
        latestVersion: null,
        lastUpdated: null
      })
    })

    test('answers null when there is no such guide', async () => {
      vi.spyOn(guidesApi, 'getGuide').mockResolvedValue(NOT_FOUND)

      expect(await getGuideById('nope')).toBeNull()
    })
  })

  describe('getGuideVersions', () => {
    test('answers the versions', async () => {
      vi.spyOn(guidesApi, 'getGuide').mockResolvedValue({
        ok: true,
        status: 200,
        data: guideResponse()
      })

      expect(await getGuideVersions('guide-1')).toEqual([{
        id: 'version-1',
        title: 'Claiming the SFI payment',
        createdBy: { id: 'dev-user-123', displayName: 'Dev User' },
        createdAt: '2026-10-06T08:00:00Z'
      }])
    })

    test('answers null when there is no such guide', async () => {
      vi.spyOn(guidesApi, 'getGuide').mockResolvedValue(NOT_FOUND)

      expect(await getGuideVersions('nope')).toBeNull()
    })
  })

  describe('getGuideContent', () => {
    test('points the content\'s images at the UI\'s asset route', async () => {
      vi.spyOn(guidesApi, 'getGuideContent').mockResolvedValue({
        ok: true,
        status: 200,
        data: '# Title\n\n![](../assets/abc123.png)\n\n[link](../assets/x/y.png)'
      })

      expect(await getGuideContent('guide 1')).toEqual({
        markdown: '# Title\n\n![](/guides/guide%201/assets/abc123.png)\n\n[link](../assets/x/y.png)'
      })
    })

    test('answers null when there is no content', async () => {
      vi.spyOn(guidesApi, 'getGuideContent').mockResolvedValue(NOT_FOUND)

      expect(await getGuideContent('nope')).toBeNull()
    })

    test('lets a failure through', async () => {
      const failure = new Error('502')
      vi.spyOn(guidesApi, 'getGuideContent').mockRejectedValue(failure)

      await expect(getGuideContent('guide-1')).rejects.toBe(failure)
    })
  })

  describe('getGuideAsset', () => {
    test('answers the image with its type and caching', async () => {
      const body = Buffer.from('png')
      vi.spyOn(guidesApi, 'getGuideAsset').mockResolvedValue({
        ok: true,
        status: 200,
        data: body,
        headers: new Headers({
          'content-type': 'image/png',
          'cache-control': 'private, max-age=31536000, immutable'
        })
      })

      expect(await getGuideAsset('guide-1', 'abc123.png')).toEqual({
        body,
        contentType: 'image/png',
        cacheControl: 'private, max-age=31536000, immutable'
      })
    })

    test('defaults the type and has no caching when the API names none', async () => {
      vi.spyOn(guidesApi, 'getGuideAsset').mockResolvedValue({
        ok: true,
        status: 200,
        data: Buffer.from(''),
        headers: new Headers()
      })

      expect(await getGuideAsset('guide-1', 'abc123.png')).toMatchObject({
        contentType: 'application/octet-stream',
        cacheControl: null
      })
    })

    test('answers null when there is no such asset', async () => {
      vi.spyOn(guidesApi, 'getGuideAsset').mockResolvedValue(NOT_FOUND)

      expect(await getGuideAsset('guide-1', 'nope.png')).toBeNull()
    })
  })
})
