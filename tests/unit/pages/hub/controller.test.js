import { statusCodes } from '../../../../src/constants/status-codes.js'
import { GuidanceApiError } from '../../../../src/infra/guidance-api/client.js'

import { getHubPage } from '../../../../src/pages/hub/controller.js'
import * as guidesService from '../../../../src/services/guides.js'

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
        filters: expect.objectContaining({ action: '/hub' })
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
          title: 'Claiming the SFI payment',
          href: '/guides/guide-1',
          versionTag: { text: 'Version 2.1', colour: 'green' },
          purpose: 'Explain the claim.',
          lastUpdated: '6 October 2026',
          published: '1 October 2026'
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
        title: 'Untitled guide',
        href: '/guides/guide-1',
        versionTag: null,
        purpose: null,
        lastUpdated: 'Not recorded',
        published: 'Not recorded'
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
})
