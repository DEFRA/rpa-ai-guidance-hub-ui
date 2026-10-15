import { statusCodes } from '../../../src/constants/status-codes.js'

import * as guidesApi from '../../../src/infra/guidance-api/guides.js'
import * as guideService from '../../../src/services/guides.js'
import * as guidanceApiFixtures from '../../fixtures/guidance-api.js'
import * as stagedDocumentsService from '../../../src/services/staged-documents.js'

vi.mock('../../../src/infra/guidance-api/guides.js')
vi.mock('../../../src/services/staged-documents.js')

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
  return guidesApi.createGuide.mockResolvedValue({
    ok: status < statusCodes.HTTP_STATUS_BAD_REQUEST,
    status,
    data: {}
  })
}

describe('guides service', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  test('sends the upload, its answers and who made it to the API', async () => {
    const createGuideSpy = mockApiResponse(statusCodes.HTTP_STATUS_CREATED)

    await guideService.createGuide(guide)

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

    const result = await guideService.createGuide(guide)

    expect(result).toEqual({ code: guideService.RESULTS.GUIDE_CREATED })
  })

  test('reports the upload expired when the API has no staged file for it', async () => {
    mockApiResponse(statusCodes.HTTP_STATUS_NOT_FOUND)

    const result = await guideService.createGuide(guide)

    expect(result).toEqual({ code: guideService.RESULTS.UPLOAD_EXPIRED })
  })

  test('reports the parse failed when the API refuses an upload whose parse failed', async () => {
    mockApiResponse(statusCodes.HTTP_STATUS_CONFLICT)
    stagedDocumentsService.getStagedDocumentById
      .mockResolvedValue({ fileId: 'file-1', parsingStatus: 'failed' })

    const result = await guideService.createGuide(guide)

    expect(result).toEqual({ code: guideService.RESULTS.PARSE_FAILED })
  })

  test.each([
    'pending',
    'in_progress'
  ])('reports the parse unfinished when the API refuses an upload whose parse is %s', async (parsingStatus) => {
    mockApiResponse(statusCodes.HTTP_STATUS_CONFLICT)
    stagedDocumentsService.getStagedDocumentById
      .mockResolvedValue({ fileId: 'file-1', parsingStatus })

    const result = await guideService.createGuide(guide)

    expect(result).toEqual({ code: guideService.RESULTS.PARSE_PENDING })
  })

  test('reports the upload expired when its staged file goes after the API refuses it as unparsed', async () => {
    mockApiResponse(statusCodes.HTTP_STATUS_CONFLICT)
    stagedDocumentsService.getStagedDocumentById.mockResolvedValue(null)

    const result = await guideService.createGuide(guide)

    expect(result).toEqual({ code: guideService.RESULTS.UPLOAD_EXPIRED })
  })

  test('lets any other failure through', async () => {
    const failure = new Error('connection refused')
    guidesApi.createGuide.mockRejectedValue(failure)

    await expect(guideService.createGuide(guide)).rejects.toBe(failure)
  })
})

const NOT_FOUND = { ok: false, status: statusCodes.HTTP_STATUS_NOT_FOUND, data: null }

describe('guides service: reading', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  describe('listGuides', () => {
    test('shapes each guide and passes the cursor on', async () => {
      guidesApi.listGuides.mockResolvedValue({
        ok: true,
        status: 200,
        data: guidanceApiFixtures.guidePageResponse({ nextCursor: 'next-1' })
      })

      const result = await guideService.listGuides({ limit: 5 })

      expect(guidesApi.listGuides).toHaveBeenCalledWith({ limit: 5 })
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
      guidesApi.listGuides.mockResolvedValue({
        ok: true,
        status: 200,
        data: guidanceApiFixtures.guidePageResponse({
          items: [guidanceApiFixtures.guideSummaryResponse({
            latestVersion: null,
            metadata: { guideTitle: 'Authored title' }
          })]
        })
      })

      const { guides } = await guideService.listGuides()

      expect(guides[0]).toMatchObject({
        title: 'Authored title',
        owner: null,
        schemes: [],
        systems: [],
        audience: [],
        lastUpdated: null
      })
    })
  })

  describe('getGuideById', () => {
    test('shapes the guide with its latest version first', async () => {
      const older = guidanceApiFixtures.versionResponse({ id: 'version-0', title: 'Old', createdAt: '2026-09-01T00:00:00Z' })
      guidesApi.getGuide.mockResolvedValue({
        ok: true,
        status: 200,
        data: guidanceApiFixtures.guideResponse({ versions: [guidanceApiFixtures.versionResponse(), older] })
      })

      const guide = await guideService.getGuideById('guide-1')

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
      guidesApi.getGuide.mockResolvedValue({
        ok: true,
        status: 200,
        data: guidanceApiFixtures.guideResponse({ versions: [] })
      })

      expect(await guideService.getGuideById('guide-1')).toMatchObject({
        title: 'Authored title',
        latestVersion: null,
        lastUpdated: null
      })
    })

    test('answers null when there is no such guide', async () => {
      guidesApi.getGuide.mockResolvedValue(NOT_FOUND)

      expect(await guideService.getGuideById('nope')).toBeNull()
    })
  })

  describe('getGuideContent', () => {
    test('answers the content\'s Markdown as the API sent it', async () => {
      const data = '# Title\n\n![](../assets/abc123.png)'
      guidesApi.getGuideContent.mockResolvedValue({ ok: true, status: 200, data })

      expect(await guideService.getGuideContent('guide-1')).toEqual({ markdown: data })
    })

    test('answers null when there is no content', async () => {
      guidesApi.getGuideContent.mockResolvedValue(NOT_FOUND)

      expect(await guideService.getGuideContent('nope')).toBeNull()
    })
  })

  describe('getGuideAsset', () => {
    test('answers the image with its type, ignoring the API\'s caching', async () => {
      const body = Buffer.from('png')
      guidesApi.getGuideAsset.mockResolvedValue({
        ok: true,
        status: 200,
        data: body,
        headers: new Headers({
          'content-type': 'Image/PNG; charset=binary',
          'cache-control': 'public, max-age=1'
        })
      })

      expect(await guideService.getGuideAsset('guide-1', 'abc123.png')).toEqual({
        body,
        contentType: 'image/png'
      })
    })

    test.each([
      'image/png',
      'image/jpeg',
      'image/webp'
    ])('serves %s', async (type) => {
      const body = Buffer.from('img')
      guidesApi.getGuideAsset.mockResolvedValue({
        ok: true,
        status: 200,
        data: body,
        headers: new Headers({ 'content-type': type })
      })

      expect(await guideService.getGuideAsset('guide-1', 'abc123.img')).toEqual({
        body,
        contentType: type
      })
    })

    test('asks the API for the guide\'s asset by name', async () => {
      guidesApi.getGuideAsset.mockResolvedValue(NOT_FOUND)

      await guideService.getGuideAsset('guide-1', 'abc123.png')

      expect(guidesApi.getGuideAsset).toHaveBeenCalledWith('guide-1', 'abc123.png')
    })

    test.each([
      ['no type', {}],
      ['an empty type', { 'content-type': '' }],
      ['an octet-stream', { 'content-type': 'application/octet-stream' }],
      ['an SVG', { 'content-type': 'image/svg+xml' }],
      ['a GIF', { 'content-type': 'image/gif' }],
      ['HTML', { 'content-type': 'text/html' }],
      ['HTML posing as an image', { 'content-type': 'text/html; name=image/png' }],
      ['a type that only starts like an allowed one', { 'content-type': 'image/png+xml' }],
      ['a type that only ends like an allowed one', { 'content-type': 'x-image/png' }],
      ['a list of types', { 'content-type': 'image/png, text/html' }]
    ])('answers null when the API names %s', async (_name, headers) => {
      guidesApi.getGuideAsset.mockResolvedValue({
        ok: true,
        status: 200,
        data: Buffer.from(''),
        headers: new Headers(headers)
      })

      expect(await guideService.getGuideAsset('guide-1', 'abc123.png')).toBeNull()
    })

    test('answers null when there is no such asset', async () => {
      guidesApi.getGuideAsset.mockResolvedValue(NOT_FOUND)

      expect(await guideService.getGuideAsset('guide-1', 'nope.png')).toBeNull()
    })
  })
})
