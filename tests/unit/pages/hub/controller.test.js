import { statusCodes } from '../../../../src/constants/status-codes.js'
import { GuidanceApiError } from '../../../../src/infra/guidance-api/client.js'

import { getHubPage } from '../../../../src/pages/hub/controller.js'
import * as guidesService from '../../../../src/services/guides.js'
import * as referenceDataService from '../../../../src/services/reference-data.js'

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
  systems: [],
  audience: [],
  lastUpdated: '2026-10-06T08:00:00Z'
}

describe('#hubController', () => {
  let h, code

  beforeEach(() => {
    vi.restoreAllMocks()
    code = vi.fn()
    h = { view: vi.fn(() => ({ code })) }
    vi.spyOn(guidesService, 'listEveryGuide').mockResolvedValue({ guides: [], counts: COUNTS })
    vi.spyOn(referenceDataService, 'getSchemes').mockResolvedValue([
      { label: 'Sustainable Farming Incentive (SFI)', shortLabel: 'SFI' }
    ])
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
        shown: expect.objectContaining({ heading: 'All guides' }),
        filters: expect.objectContaining({ action: '/hub' })
      })
      expect(code).toHaveBeenCalledWith(statusCodes.HTTP_STATUS_OK)
    })

    test('Should list every guide, each linking to the guide', async () => {
      guidesService.listEveryGuide.mockResolvedValue({ guides: [listedGuide], counts: COUNTS })

      await getHubPage({ query: {} }, h)

      const [, viewModel] = h.view.mock.calls[0]

      expect(viewModel.allGuides.count).toBe(1)
      expect(viewModel.allGuides.rows).toEqual([[
        { type: 'link', text: 'Claiming the SFI payment', href: '/guides/guide-1' },
        { type: 'text', text: 'SFI, Retired scheme' },
        { type: 'text', text: '6 October 2026' },
        { type: 'text', text: 'owner@example.com' }
      ]])
    })

    test('Should say when a guide has no title, schemes, date or owner', async () => {
      guidesService.listEveryGuide.mockResolvedValue({
        guides: [{ ...listedGuide, title: null, schemes: [], owner: null, lastUpdated: null }],
        counts: COUNTS
      })

      await getHubPage({ query: {} }, h)

      const [, viewModel] = h.view.mock.calls[0]

      expect(viewModel.allGuides.rows[0].map(cell => cell.text)).toEqual([
        'Untitled guide',
        'Not recorded',
        'Not recorded',
        'Not recorded'
      ])
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

    test('Should show stored scheme labels when the schemes are unavailable', async () => {
      guidesService.listEveryGuide.mockResolvedValue({ guides: [listedGuide], counts: COUNTS })
      referenceDataService.getSchemes.mockRejectedValue(new Error('metadata unavailable'))

      await getHubPage({ query: {} }, h)

      const [, viewModel] = h.view.mock.calls[0]
      expect(viewModel.allGuides.rows[0][1].text).toBe(
        'Sustainable Farming Incentive (SFI), Retired scheme'
      )
      expect(code).toHaveBeenCalledWith(statusCodes.HTTP_STATUS_OK)
    })
  })
})
