import { statusCodes } from '../../../../src/constants/status-codes.js'
import { GuidanceApiError } from '../../../../src/infra/guidance-api/client.js'

import { getHubListPage, getHubPage } from '../../../../src/pages/hub/controller.js'
import * as guidesService from '../../../../src/services/guides.js'
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
        words: ''
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

    test('Should keep the search words, in the search box and the filters, while listing every guide', async () => {
      await getHubPage({ query: { q: 'claim rules', audience: 'Processor' } }, h)

      const [, viewModel] = h.view.mock.calls[0]
      expect(guidesService.listEveryGuide).toHaveBeenCalledWith({
        filters: { audience: ['Processor'], system: [], scheme: [], noScheme: false },
        sort: 'updated-newest'
      })
      expect(viewModel.words).toBe('claim rules')
      expect(viewModel.filters.kept).toEqual({ q: 'claim rules' })
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
