import { statusCodes } from '../../../../src/constants/status-codes.js'

import { getHubPage } from '../../../../src/pages/hub/controller.js'
import * as guidesService from '../../../../src/services/guides.js'
import * as referenceDataService from '../../../../src/services/reference-data.js'

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
    vi.spyOn(guidesService, 'listGuides').mockResolvedValue({ guides: [], nextCursor: null })
    vi.spyOn(referenceDataService, 'getSchemes').mockResolvedValue([
      { label: 'Sustainable Farming Incentive (SFI)', shortLabel: 'SFI' }
    ])
  })

  describe('getHubPage', () => {
    test('Should render the hub page with the guidance view models', async () => {
      await getHubPage({}, h)

      expect(h.view).toHaveBeenCalledWith('hub/page.njk', {
        recentlyOpened: expect.objectContaining({
          isEmpty: expect.any(Boolean),
          count: expect.any(Number)
        }),
        savedGuidance: expect.objectContaining({
          isEmpty: expect.any(Boolean),
          count: expect.any(Number)
        }),
        editing: expect.objectContaining({
          isEmpty: expect.any(Boolean),
          count: expect.any(Number)
        }),
        awaitingApproval: expect.objectContaining({
          isEmpty: expect.any(Boolean),
          count: expect.any(Number)
        }),
        allGuides: expect.objectContaining({
          isEmpty: true,
          count: 0
        })
      })
      expect(code).toHaveBeenCalledWith(statusCodes.HTTP_STATUS_OK)
    })

    test('Should list every guide, each linking to the guide', async () => {
      guidesService.listGuides.mockResolvedValue({ guides: [listedGuide], nextCursor: null })

      await getHubPage({}, h)

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
      guidesService.listGuides.mockResolvedValue({
        guides: [{ ...listedGuide, title: null, schemes: [], owner: null, lastUpdated: null }],
        nextCursor: null
      })

      await getHubPage({}, h)

      const [, viewModel] = h.view.mock.calls[0]

      expect(viewModel.allGuides.rows[0].map(cell => cell.text)).toEqual([
        'Untitled guide',
        'Not recorded',
        'Not recorded',
        'Not recorded'
      ])
    })

    test('Should let a failure to list the guides through', async () => {
      const failure = new Error('connection refused')
      guidesService.listGuides.mockRejectedValue(failure)

      await expect(getHubPage({}, h)).rejects.toBe(failure)
    })
  })
})
