import { statusCodes } from '../../../../src/constants/status-codes.js'

import { DEFAULT_TAB, getHubPage } from '../../../../src/pages/hub/controller.js'

describe('#hubController', () => {
  let h, code

  beforeEach(() => {
    code = vi.fn()
    h = { view: vi.fn(() => ({ code })) }
    vi.clearAllMocks()
  })

  describe('getHubPage', () => {
    test('Should render the hub page with recently opened, saved, editing and awaiting approval guidance tables and default activeTab', async () => {
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
        activeTab: DEFAULT_TAB
      })
      expect(code).toHaveBeenCalledWith(statusCodes.HTTP_STATUS_OK)
    })

    test('Should set activeTab to requested tab when valid', async () => {
      const request = { query: { tab: 'editing' } }
      await getHubPage(request, h)

      expect(h.view).toHaveBeenCalledWith('hub/page.njk', expect.objectContaining({
        activeTab: 'editing'
      }))
    })

    test('Should fallback to default activeTab when tab param is unknown', async () => {
      const request = { query: { tab: 'invalid-tab' } }
      await getHubPage(request, h)

      expect(h.view).toHaveBeenCalledWith('hub/page.njk', expect.objectContaining({
        activeTab: DEFAULT_TAB
      }))
    })
  })
})
