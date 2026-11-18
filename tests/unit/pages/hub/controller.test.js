import { statusCodes } from '../../../../src/constants/status-codes.js'
import { GuidanceApiError } from '../../../../src/infra/guidance-api/client.js'

import { getHubListPage, getHubPage } from '../../../../src/pages/hub/controller.js'
import * as guidesService from '../../../../src/services/guides.js'
import * as searchService from '../../../../src/services/search.js'
import * as usersService from '../../../../src/services/users.js'

const COUNTS = {
  audience: [{ label: 'Processor', shortLabel: null, count: 2 }],
  system: [{ label: 'CRM', shortLabel: null, count: 2 }],
  scheme: [{ label: 'Countryside Stewardship', shortLabel: 'CS', count: 2 }]
}

const listedGuide = {
  id: 'guide-1',
  title: 'Claiming the SFI payment',
  owner: 'owner@example.com',
  schemes: ['Sustainable Farming Incentive (SFI)', 'Retired scheme'],
  systems: ['CRM'],
  audience: ['Processor', 'Team leader'],
  purpose: 'Explain the claim.',
  versionNumber: '2.1',
  lastUpdated: '2026-10-06T08:00:00Z',
  createdAt: '2026-10-01T09:00:00'
}

describe('#hubController', () => {
  let h, code

  beforeEach(() => {
    vi.restoreAllMocks()
    code = vi.fn()
    h = { view: vi.fn(() => ({ code })) }
    vi.spyOn(guidesService, 'listEveryGuide').mockResolvedValue({ guides: [], counts: COUNTS })
    vi.spyOn(usersService, 'pinnedOf').mockResolvedValue([])
  })

  describe('getHubPage', () => {
    test('Should render the hub page with the guidance view models', async () => {
      await getHubPage({ query: {} }, h)

      expect(h.view).toHaveBeenCalledWith('hub/page.njk', {
        recentlyOpened: expect.objectContaining({
          isEmpty: expect.any(Boolean),
          count: expect.any(Number)
        }),
        pinned: expect.objectContaining({
          isEmpty: expect.any(Boolean),
          count: expect.any(Number)
        }),
        bookmarkedGuides: expect.objectContaining({
          isEmpty: expect.any(Boolean),
          count: expect.any(Number)
        }),
        allGuides: expect.objectContaining({
          isEmpty: true,
          count: 0
        }),
        shown: expect.objectContaining({ heading: '0 guides' }),
        filters: expect.objectContaining({ action: '/hub' }),
        words: '',
        search: null,
        searchUnavailable: false
      })
      expect(code).toHaveBeenCalledWith(statusCodes.HTTP_STATUS_OK)
    })

    test('Should list every guide, in the API\'s order, each as a row of its own', async () => {
      guidesService.listEveryGuide.mockResolvedValue({ guides: [listedGuide, { ...listedGuide, id: 'guide-2', title: 'Closing a case' }], counts: COUNTS })

      await getHubPage({ query: {} }, h)

      const [, viewModel] = h.view.mock.calls[0]

      expect(viewModel.allGuides.count).toBe(2)
      expect(viewModel.allGuides.guides).toEqual([
        {
          id: 'guide-1',
          title: 'Claiming the SFI payment',
          href: '/guides/guide-1',
          versionTag: { text: 'Version 2.1', colour: 'green' },
          purpose: 'Explain the claim.',
          lastUpdated: '6 October 2026',
          published: '1 October 2026',
          pin: { pinned: false, position: null, key: 'guide-1' }
        },
        expect.objectContaining({ title: 'Closing a case', href: '/guides/guide-2' })
      ])
    })

    test('Should say when a guide has no title or dates, and show no version or purpose it does not have', async () => {
      guidesService.listEveryGuide.mockResolvedValue({
        guides: [{ ...listedGuide, title: null, purpose: null, versionNumber: null, lastUpdated: null, createdAt: null }],
        counts: COUNTS
      })

      await getHubPage({ query: {} }, h)

      const [, viewModel] = h.view.mock.calls[0]

      expect(viewModel.allGuides.guides).toEqual([{
        id: 'guide-1',
        title: 'Untitled guide',
        href: '/guides/guide-1',
        versionTag: null,
        purpose: null,
        lastUpdated: 'Not recorded',
        published: 'Not recorded',
        pin: { pinned: false, position: null, key: 'guide-1' }
      }])
    })

    test('Should list the guides the filters let through, sorted as asked, beside the filters', async () => {
      const request = { query: { audience: 'Processor', sort: 'updated-oldest' } }

      await getHubPage(request, h)

      const [, viewModel] = h.view.mock.calls[0]
      expect(guidesService.listEveryGuide).toHaveBeenCalledWith({
        filters: { audience: ['Processor'], system: [], scheme: [], noScheme: false },
        sort: 'updated-oldest'
      })
      expect(viewModel.filters.action).toBe('/hub')
      expect(viewModel.filters.selected).toEqual([{ text: 'Processor', href: '/hub?sort=updated-oldest' }])
      expect(viewModel.filters.sort.options.find(option => option.selected).value).toBe('updated-oldest')
    })

    describe('with words searched for', () => {
      const GUIDE = '7c9e6679-7425-40de-944b-e07fc1f90ae7'
      const section = { title: '4.2 Claim rules', href: '/guides/g-1#claim-rules', documentTitle: 'CS final payments', matches: 2, snippet: [{ text: 'claim', match: true }] }
      const found = {
        unavailable: false,
        total: 12,
        documentTotal: 12,
        sectionTotal: 30,
        tooManyMatches: false,
        results: [{ id: 'g-1', title: 'CS final payments', href: '/guides/g-1', titleSnippet: null, sectionTotal: 1, sections: [section] }],
        titles: []
      }
      const promoted = { id: 't-1', title: 'CS MA Claim - Case 1', href: '/guides/t-1', titleSnippet: null, sectionTotal: 0, sections: [] }

      beforeEach(() => {
        vi.spyOn(searchService, 'searchGuides').mockResolvedValue(found)
        vi.spyOn(searchService, 'searchGuide').mockResolvedValue({ unavailable: false, total: 1, tooManyMatches: false, results: [section] })
      })

      test('Should search every guide for the words, a page of guides at a time, the page the address asks for', async () => {
        await getHubPage({ query: { q: ' claim rules ', page: '2' } }, h)

        expect(searchService.searchGuides).toHaveBeenCalledWith({ words: 'claim rules', page: 2, perPage: 10 })
        expect(searchService.searchGuide).not.toHaveBeenCalled()
      })

      test('Should search inside the guide the address asks for, a page of its sections at a time', async () => {
        await getHubPage({ query: { q: 'claim', guide: GUIDE, page: '2' } }, h)

        const [, viewModel] = h.view.mock.calls[0]
        expect(searchService.searchGuide).toHaveBeenCalledWith({ words: 'claim', guideId: GUIDE, page: 2, perPage: 10 })
        expect(searchService.searchGuides).not.toHaveBeenCalled()
        expect(viewModel.search.results).toEqual([expect.objectContaining({ title: '4.2 Claim rules' })])
      })

      test('Should search every guide when the address\'s guide is not one', async () => {
        await getHubPage({ query: { q: 'claim', guide: 'nope' } }, h)

        expect(searchService.searchGuides).toHaveBeenCalled()
        expect(searchService.searchGuide).not.toHaveBeenCalled()
      })

      test('Should show what search found instead of the list of guides and its filters', async () => {
        await getHubPage({ query: { q: 'claim rules', audience: 'Processor' } }, h)

        const [, viewModel] = h.view.mock.calls[0]
        expect(guidesService.listEveryGuide).not.toHaveBeenCalled()
        expect(usersService.pinnedOf).not.toHaveBeenCalled()
        expect(viewModel.filters).toBeNull()
        expect(viewModel.words).toBe('claim rules')
        expect(viewModel.search).toEqual(expect.objectContaining({
          heading: '12 guides',
          guides: [expect.objectContaining({
            title: 'CS final payments',
            sections: [expect.objectContaining({ title: '4.2 Claim rules', href: '/guides/g-1#claim-rules' })]
          })]
        }))
        expect(code).toHaveBeenCalledWith(statusCodes.HTTP_STATUS_OK)
      })

      test('Should promote the one guide whose title the words cover, with what it is for', async () => {
        searchService.searchGuides.mockResolvedValue({ ...found, titles: [promoted] })
        vi.spyOn(guidesService, 'getGuideById').mockResolvedValue({ id: 't-1', metadata: { goal: 'Check a claim\'s weight.' } })

        await getHubPage({ query: { q: 'CS MA Claim' } }, h)

        const [, viewModel] = h.view.mock.calls[0]
        expect(guidesService.getGuideById).toHaveBeenCalledWith('t-1')
        expect(viewModel.search.titleBlock).toEqual(expect.objectContaining({ kind: 'strong', purpose: 'Check a claim\'s weight.' }))
      })

      test('Should promote the guide without what it is for when the guide can\'t be read', async () => {
        searchService.searchGuides.mockResolvedValue({ ...found, titles: [promoted] })
        vi.spyOn(guidesService, 'getGuideById').mockRejectedValue(new GuidanceApiError('API is down', 503))
        const logger = { warn: vi.fn() }

        await getHubPage({ query: { q: 'CS MA Claim' }, logger }, h)

        const [, viewModel] = h.view.mock.calls[0]
        expect(viewModel.search.titleBlock).toEqual(expect.objectContaining({ kind: 'strong', purpose: null }))
        expect(logger.warn).toHaveBeenCalled()
        expect(code).toHaveBeenCalledWith(statusCodes.HTTP_STATUS_OK)
      })

      test('Should not read a guide when the words cover several titles, or none', async () => {
        vi.spyOn(guidesService, 'getGuideById')
        searchService.searchGuides.mockResolvedValueOnce({ ...found, titles: [promoted, { ...promoted, id: 't-2' }] })

        await getHubPage({ query: { q: 'CS MA Claim' } }, h)
        await getHubPage({ query: { q: 'claim' } }, h)

        expect(guidesService.getGuideById).not.toHaveBeenCalled()
      })

      test('Should not read the promoted guide past the first page, where it is not shown', async () => {
        searchService.searchGuides.mockResolvedValue({ ...found, titles: [promoted] })
        vi.spyOn(guidesService, 'getGuideById')

        await getHubPage({ query: { q: 'CS MA Claim', page: '2' } }, h)

        expect(guidesService.getGuideById).not.toHaveBeenCalled()
      })

      test('Should list every guide the filters let through, saying search is not available, when search can\'t answer', async () => {
        searchService.searchGuides.mockResolvedValue({ unavailable: true, total: 0, documentTotal: 0, sectionTotal: 0, tooManyMatches: false, results: [], titles: [] })

        await getHubPage({ query: { q: 'claim rules', audience: 'Processor' } }, h)

        const [, viewModel] = h.view.mock.calls[0]
        expect(guidesService.listEveryGuide).toHaveBeenCalledWith({
          filters: { audience: ['Processor'], system: [], scheme: [], noScheme: false },
          sort: 'updated-newest'
        })
        expect(viewModel.searchUnavailable).toBe(true)
        expect(viewModel.search).toBeNull()
        expect(viewModel.words).toBe('claim rules')
        expect(viewModel.filters.kept).toEqual({ q: 'claim rules' })
        expect(code).toHaveBeenCalledWith(statusCodes.HTTP_STATUS_OK)
      })
    })

    test('Should not search when no words are searched for', async () => {
      vi.spyOn(searchService, 'searchGuides')

      await getHubPage({ query: { q: '   ' } }, h)

      expect(searchService.searchGuides).not.toHaveBeenCalled()
    })

    test('Should put the pinned guides first, in the user\'s order, then the rest as sorted', async () => {
      const guide = id => ({ ...listedGuide, id })
      guidesService.listEveryGuide.mockResolvedValue({ guides: [guide('g-1'), guide('g-2'), guide('g-3')], counts: COUNTS })
      usersService.pinnedOf.mockResolvedValue([{ id: 'g-3', title: 'Three' }, { id: 'g-9', title: 'Hidden by a filter' }, { id: 'g-1', title: 'One' }])

      await getHubPage({ query: {} }, h)

      const [, viewModel] = h.view.mock.calls[0]
      expect(viewModel.allGuides.guides.map(row => [row.id, row.pin])).toEqual([
        ['g-3', { pinned: true, position: 0, key: 'g-3' }],
        ['g-1', { pinned: true, position: 2, key: 'g-1' }],
        ['g-2', { pinned: false, position: null, key: 'g-2' }]
      ])
    })

    test('Should offer no pins when the user\'s pins are not known', async () => {
      guidesService.listEveryGuide.mockResolvedValue({ guides: [listedGuide], counts: COUNTS })
      usersService.pinnedOf.mockResolvedValue(null)

      await getHubPage({ query: {} }, h)

      const [, viewModel] = h.view.mock.calls[0]
      expect(viewModel.allGuides.guides[0].pin).toBeNull()
    })

    test('Should answer a filter value the hub does not have as a bad request', async () => {
      guidesService.listEveryGuide.mockRejectedValue(new GuidanceApiError('guidance API GET /guides failed: 422', 422))

      await expect(getHubPage({ query: { audience: 'Martians' } }, h)).rejects.toMatchObject({
        isBoom: true,
        output: { statusCode: statusCodes.HTTP_STATUS_BAD_REQUEST }
      })
    })

    test('Should let a failure to list the guides through', async () => {
      const failure = new Error('connection refused')
      guidesService.listEveryGuide.mockRejectedValue(failure)

      await expect(getHubPage({ query: {} }, h)).rejects.toBe(failure)
    })
  })

  describe('getHubListPage', () => {
    test('Should show the guides the user pinned, in their order, beside the filters, without a sort', async () => {
      vi.spyOn(usersService, 'listPinned').mockResolvedValue({ guides: [{ ...listedGuide, id: 'g-2', position: 1 }], counts: COUNTS })
      const request = { params: { list: 'pinned' }, query: { system: 'CRM' } }

      await getHubListPage(request, h)

      const [, viewModel] = h.view.mock.calls[0]
      expect(usersService.listPinned).toHaveBeenCalledWith(request, { audience: [], system: ['CRM'], scheme: [], noScheme: false })
      expect(viewModel.shown.heading).toBe('1 pin')
      expect(viewModel.pinned.guides.map(row => [row.id, row.pin])).toEqual([['g-2', { pinned: true, position: 1, key: 'g-2' }]])
      expect(usersService.pinnedOf).not.toHaveBeenCalled()
      expect(viewModel.filters.action).toBe('/hub/pinned')
      expect(viewModel.filters.sort).toBeNull()
    })

    test('Should show the guides the user opened most recently, newest first, beside the filters, without a sort', async () => {
      vi.spyOn(usersService, 'listRecentlyOpened').mockResolvedValue({
        guides: [{ ...listedGuide, id: 'g-2' }, listedGuide],
        counts: COUNTS
      })
      usersService.pinnedOf.mockResolvedValue([{ id: 'other' }, { id: 'guide-1' }])
      const request = { params: { list: 'recently-opened' }, query: { system: 'CRM' } }

      await getHubListPage(request, h)

      const [, viewModel] = h.view.mock.calls[0]
      expect(usersService.listRecentlyOpened).toHaveBeenCalledWith(request, { audience: [], system: ['CRM'], scheme: [], noScheme: false })
      expect(viewModel.shown.heading).toBe('2 recently opened guides')
      expect(viewModel.recentlyOpened.guides.map(row => [row.id, row.pin])).toEqual([
        ['g-2', { pinned: false, position: null, key: 'g-2' }],
        ['guide-1', { pinned: true, position: 1, key: 'guide-1' }]
      ])
      expect(viewModel.filters.action).toBe('/hub/recently-opened')
      expect(viewModel.filters.sort).toBeNull()
    })

    test.each([
      ['pinned', 'listPinned'],
      ['recently-opened', 'listRecentlyOpened']
    ])('Should answer a filter value the hub does not have as a bad request, on /hub/%s', async (list, listing) => {
      vi.spyOn(usersService, listing).mockRejectedValue(new GuidanceApiError(`guidance API GET /users/u/${list} failed: 422`, 422))

      await expect(getHubListPage({ params: { list }, query: { audience: 'Martians' } }, h)).rejects.toMatchObject({
        isBoom: true,
        output: { statusCode: statusCodes.HTTP_STATUS_BAD_REQUEST }
      })
    })

    test('Should list the bookmarked guides in the API\'s order, each with its star, beside the filters, without a sort', async () => {
      vi.spyOn(usersService, 'listBookmarked').mockResolvedValue({ guides: [listedGuide, { ...listedGuide, id: 'guide-2' }], counts: COUNTS })
      vi.spyOn(usersService, 'pinnedOf').mockResolvedValue([{ id: 'guide-2', sectionId: null }])
      const request = { params: { list: 'bookmarked-guides' }, query: { system: 'CRM' } }

      await getHubListPage(request, h)

      const [, viewModel] = h.view.mock.calls[0]
      expect(usersService.listBookmarked).toHaveBeenCalledWith(request, { audience: [], system: ['CRM'], scheme: [], noScheme: false }, undefined)
      expect(viewModel.shown).toBe(viewModel.bookmarkedGuides)
      expect(viewModel.shown.guides.map((row) => [row.id, row.pin.pinned])).toEqual([['guide-1', false], ['guide-2', true]])
      expect(viewModel.filters.action).toBe('/hub/bookmarked-guides')
      expect(viewModel.filters.sort).toBeNull()
    })

    test('Should narrow the bookmarked guides to one of the user\'s cases, by its key, shown as a selected filter', async () => {
      vi.spyOn(usersService, 'casesOf').mockResolvedValue([{ key: 'key-1', type: 'case', ref: 'W1234567', guides: [] }])
      vi.spyOn(usersService, 'listBookmarked').mockResolvedValue({ guides: [listedGuide], counts: COUNTS })
      const request = { params: { list: 'bookmarked-guides' }, query: { case: 'key-1' } }

      await getHubListPage(request, h)

      const [, viewModel] = h.view.mock.calls[0]
      expect(usersService.listBookmarked).toHaveBeenCalledWith(request, { audience: [], system: [], scheme: [], noScheme: false }, 'key-1')
      expect(viewModel.filters.selected).toEqual([{ text: 'Case: W1234567', href: '/hub/bookmarked-guides' }])
      expect(viewModel.filters.kept).toEqual({ case: 'key-1' })
    })

    test('Should answer bad gateway when the user\'s cases cannot be read', async () => {
      vi.spyOn(usersService, 'casesOf').mockResolvedValue(null)
      vi.spyOn(usersService, 'listBookmarked')

      await expect(getHubListPage({ params: { list: 'bookmarked-guides' }, query: { case: 'key-1' } }, h)).rejects.toMatchObject({
        isBoom: true,
        message: 'The case bookmarks cannot be read',
        output: { statusCode: statusCodes.HTTP_STATUS_BAD_GATEWAY }
      })
      expect(usersService.listBookmarked).not.toHaveBeenCalled()
    })

    test('Should answer a case the user has not got as not found, without listing anything', async () => {
      vi.spyOn(usersService, 'casesOf').mockResolvedValue([{ key: 'key-1', type: 'case', ref: 'W1234567', guides: [] }])
      vi.spyOn(usersService, 'listBookmarked')

      await expect(getHubListPage({ params: { list: 'bookmarked-guides' }, query: { case: 'key-9' } }, h)).rejects.toMatchObject({
        isBoom: true,
        output: { statusCode: statusCodes.HTTP_STATUS_NOT_FOUND }
      })
      expect(usersService.listBookmarked).not.toHaveBeenCalled()
    })
  })
})
