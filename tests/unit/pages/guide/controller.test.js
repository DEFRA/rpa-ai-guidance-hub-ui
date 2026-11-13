import { statusCodes } from '../../../../src/constants/status-codes.js'
import * as controller from '../../../../src/pages/guide/controller.js'
import * as guidesService from '../../../../src/services/guides.js'
import * as usersService from '../../../../src/services/users.js'

const guide = {
  id: 'guide-1',
  title: 'Claiming the SFI payment',
  metadata: { schemes: ['sfi'] },
  versions: [{ id: 'v1' }],
  lastUpdated: '2026-10-06T08:00:00Z'
}

const markdown = '## One\n\nFirst.\n\n## Two\n\nSecond.\n\n## Three\n\nThird.'

function createRequest ({ query = {}, payload, stored, format } = {}) {
  const session = new Map([
    ...(stored ? [['guide-reading-width', stored]] : []),
    ...(format ? [['guide-format', format]] : [])
  ])

  return {
    params: { guideId: 'guide-1', name: 'abc.png' },
    query,
    payload,
    url: { pathname: '/guides/guide-1', search: '?section=two' },
    yar: { get: key => session.get(key), set: (key, value) => session.set(key, value), flash: () => [], session }
  }
}

function createToolkit () {
  const code = vi.fn()
  const response = { type: vi.fn(() => response), header: vi.fn(() => response) }

  return { view: vi.fn(() => ({ code })), redirect: vi.fn(() => 'redirected'), response: vi.fn(() => response), code, assetResponse: response }
}

describe('guide controller', () => {
  let h

  beforeEach(() => {
    vi.restoreAllMocks()
    h = createToolkit()
    vi.spyOn(guidesService, 'getGuideById').mockResolvedValue(guide)
    vi.spyOn(guidesService, 'getGuideContent').mockResolvedValue({ markdown })
    vi.spyOn(usersService, 'pinnedOf').mockResolvedValue([])
    vi.spyOn(usersService, 'casesOf').mockResolvedValue([])
    vi.spyOn(usersService, 'recordOpened').mockResolvedValue()
  })

  describe('getGuidePage', () => {
    test('renders the first section by default', async () => {
      await controller.getGuidePage(createRequest(), h)

      const [view, viewModel] = h.view.mock.calls[0]

      expect(view).toBe('guide/page.njk')
      expect(viewModel).toMatchObject({ pageNumber: 1, totalPages: 3, readingWidth: 'standard' })
      expect(h.code).toHaveBeenCalledWith(statusCodes.HTTP_STATUS_OK)
    })

    test.each([
      ['pinned', [{ id: 'other' }, { id: 'guide-1' }], { pinned: true, position: 1 }],
      ['not pinned', [{ id: 'other' }], { pinned: false, position: null }],
      ['not known to be pinned', null, null]
    ])('knows whether the guide is %s, for its Pin guide button', async (_name, pinned, pin) => {
      usersService.pinnedOf.mockResolvedValue(pinned)

      await controller.getGuidePage(createRequest(), h)

      expect(h.view.mock.calls[0][1].pin).toEqual(pin)
    })

    test('records the guide as opened by the user when it is opened, without a page', async () => {
      const request = createRequest()

      await controller.getGuidePage(request, h)

      expect(usersService.recordOpened).toHaveBeenCalledWith(request, 'guide-1')
    })

    test('records the guide as opened when a link names one of its sections', async () => {
      const request = createRequest({ query: { section: 'two' } })

      await controller.getGuidePage(request, h)

      expect(usersService.recordOpened).toHaveBeenCalledWith(request, 'guide-1')
    })

    test('does not record a guide there is not', async () => {
      guidesService.getGuideById.mockResolvedValue(null)

      await expect(controller.getGuidePage(createRequest(), h)).rejects.toMatchObject({ isBoom: true })
      expect(usersService.recordOpened).not.toHaveBeenCalled()
    })

    test('renders the section asked for, and the chosen width', async () => {
      const request = createRequest({ query: { section: 'two' }, stored: 'full' })

      await controller.getGuidePage(request, h)

      expect(h.view.mock.calls[0][1]).toMatchObject({
        panelCollapsed: false,
        pageNumber: 2,
        readingWidth: 'full',
        returnTo: '/guides/guide-1?section=two'
      })
    })

    test.each([
      [undefined, 'traditional'],
      ['stepper', 'stepper']
    ])('shows the guide in the format chosen, whole until one is (%j)', async (format, shown) => {
      await controller.getGuidePage(createRequest({ format }), h)

      expect(h.view.mock.calls[0][1].format).toBe(shown)
    })

    test.each([
      ['two', 2],
      ['never', 1],
      [undefined, 1]
    ])('shows the page with section %j as page %i, without sending the reader on', async (section, expected) => {
      await controller.getGuidePage(createRequest({ query: { section } }), h)

      expect(h.view.mock.calls[0][1].pageNumber).toBe(expected)
      expect(h.redirect).not.toHaveBeenCalled()
    })

    test('shows the page that has a heading inside one of its sections', async () => {
      guidesService.getGuideContent.mockResolvedValue({ markdown: '## One\n\nFirst.\n\n## Two\n\n### 2.1 Deep\n\nSecond.' })

      await controller.getGuidePage(createRequest({ query: { section: '21-deep' } }), h)

      expect(h.view.mock.calls[0][1].pageNumber).toBe(2)
    })

    test('takes a repeated heading by the hub\'s anchor, which the page numbers differently, as the contents name it', async () => {
      // The title is counted by the page and not by the hub, so the first
      // `### Help` is `help-1` on the page and `help` to the hub.
      guidesService.getGuideContent.mockResolvedValue({ markdown: '# Help\n\n## One\n\n### Help\n\n## Two\n\n### Help' })

      await controller.getGuidePage(createRequest({ query: { section: 'help' } }), h)
      await controller.getGuidePage(createRequest({ query: { section: 'help-1' } }), h)

      expect(h.view.mock.calls.map(([, viewModel]) => viewModel.pageNumber)).toEqual([1, 2])
    })

    test('ignores a page number in the address', async () => {
      await controller.getGuidePage(createRequest({ query: { page: '2' } }), h)

      expect(h.view.mock.calls[0][1].pageNumber).toBe(1)
    })

    test.each([
      ['there is no such guide', () => guidesService.getGuideById.mockResolvedValue(null)],
      ['it has no content', () => guidesService.getGuideContent.mockResolvedValue(null)],
      ['its content is empty', () => guidesService.getGuideContent.mockResolvedValue({ markdown: '  ' })]
    ])('is not found when %s', async (_name, arrange) => {
      arrange()

      await expect(controller.getGuidePage(createRequest(), h)).rejects.toMatchObject({
        isBoom: true,
        output: { statusCode: statusCodes.HTTP_STATUS_NOT_FOUND }
      })
    })
  })

  describe('postReadingWidth', () => {
    test('remembers the width and goes back to the page', () => {
      const request = createRequest({ payload: { width: 'wide', returnTo: '/guides/guide-1?page=2' } })

      controller.postReadingWidth(request, h)

      expect(request.yar.session.get('guide-reading-width')).toBe('wide')
      expect(h.redirect).toHaveBeenCalledWith('/guides/guide-1?page=2')
    })

    test.each([[''], ['https://evil.example'], ['//evil.example']])('goes to the hub instead of %j', (returnTo) => {
      controller.postReadingWidth(createRequest({ payload: { width: 'full', returnTo } }), h)

      expect(h.redirect).toHaveBeenCalledWith('/hub')
    })
  })

  describe('postFormat', () => {
    test('remembers the format and goes back to the reader\'s place', () => {
      const request = createRequest({ payload: { format: 'stepper', returnTo: '/guides/guide-1?page=2#two' } })

      controller.postFormat(request, h)

      expect(request.yar.session.get('guide-format')).toBe('stepper')
      expect(h.redirect).toHaveBeenCalledWith('/guides/guide-1?page=2#two')
    })

    test.each([[''], ['https://evil.example'], ['//evil.example']])('goes to the hub instead of %j', (returnTo) => {
      controller.postFormat(createRequest({ payload: { format: 'traditional', returnTo } }), h)

      expect(h.redirect).toHaveBeenCalledWith('/hub')
    })
  })

  describe('postPanelToggle', () => {
    test('remembers the panel as collapsed, and goes back to the page', () => {
      const request = createRequest({ payload: { collapsed: true, returnTo: '/guides/guide-1?page=2' } })

      controller.postPanelToggle(request, h)

      expect(request.yar.session.get('guide-panel-collapsed')).toBe(true)
      expect(h.redirect).toHaveBeenCalledWith('/guides/guide-1?page=2')
    })

    test('remembers the panel as open', () => {
      const request = createRequest({ payload: { collapsed: false, returnTo: '' } })

      controller.postPanelToggle(request, h)

      expect(request.yar.session.get('guide-panel-collapsed')).toBe(false)
      expect(h.redirect).toHaveBeenCalledWith('/hub')
    })
  })

  describe('getGuideAsset', () => {
    test('serves the image with its type and caching', async () => {
      const body = Buffer.from('png')
      vi.spyOn(guidesService, 'getGuideAsset').mockResolvedValue({
        body,
        contentType: 'image/png',
        cacheControl: 'private, max-age=60'
      })

      await controller.getGuideAsset(createRequest(), h)

      expect(guidesService.getGuideAsset).toHaveBeenCalledWith('guide-1', 'abc.png')
      expect(h.response).toHaveBeenCalledWith(body)
      expect(h.assetResponse.type).toHaveBeenCalledWith('image/png')
      expect(h.assetResponse.header).toHaveBeenCalledWith('cache-control', 'private, max-age=60')
    })

    test('lets the browser keep an image the API gave no caching for', async () => {
      vi.spyOn(guidesService, 'getGuideAsset').mockResolvedValue({
        body: Buffer.from(''),
        contentType: 'image/png',
        cacheControl: null
      })

      await controller.getGuideAsset(createRequest(), h)

      expect(h.assetResponse.header).toHaveBeenCalledWith('cache-control', 'private, max-age=31536000, immutable')
    })

    test('is not found when there is no such asset', async () => {
      vi.spyOn(guidesService, 'getGuideAsset').mockResolvedValue(null)

      await expect(controller.getGuideAsset(createRequest(), h)).rejects.toMatchObject({
        output: { statusCode: statusCodes.HTTP_STATUS_NOT_FOUND }
      })
    })

    test.each([
      'image/jpeg',
      'image/png',
      'image/webp'
    ])('is found when %s is in the allow list', async (contentType) => {
      vi.spyOn(guidesService, 'getGuideAsset').mockResolvedValue({
        body: Buffer.from(''),
        contentType,
        cacheControl: null
      })

      const response = await controller.getGuideAsset(createRequest(), h)

      expect(response).toBe(h.assetResponse)
      expect(h.assetResponse.type).toHaveBeenCalledWith(contentType)
      expect(h.assetResponse.header).toHaveBeenCalledWith('x-content-type-options', 'nosniff')
      expect(h.assetResponse.header).toHaveBeenCalledWith('content-security-policy', "default-src 'none'; sandbox")
    })

    test.each([
      ['image/png; charset=binary', 'image/png'],
      ['IMAGE/PNG', 'image/png']
    ])('serves %j as %s', async (contentType, expected) => {
      vi.spyOn(guidesService, 'getGuideAsset').mockResolvedValue({
        body: Buffer.from(''),
        contentType,
        cacheControl: null
      })

      await controller.getGuideAsset(createRequest(), h)

      expect(h.assetResponse.type).toHaveBeenCalledWith(expected)
    })

    test.each([
      'text/html',
      'image/svg+xml',
      'image/gif',
      undefined
    ])('is not found when %s is not in the allow list', async (contentType) => {
      vi.spyOn(guidesService, 'getGuideAsset').mockResolvedValue({
        body: Buffer.from(''),
        contentType,
        cacheControl: null
      })

      await expect(controller.getGuideAsset(createRequest(), h)).rejects.toMatchObject({
        output: { statusCode: statusCodes.HTTP_STATUS_NOT_FOUND }
      })
      expect(h.response).not.toHaveBeenCalled()
    })
  })
})
