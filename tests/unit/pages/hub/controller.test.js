import { statusCodes } from '../../../../src/constants/status-codes.js'

import { getHubPage } from '../../../../src/pages/hub/controller.js'

describe('#hubController', () => {
  let h, code

  beforeEach(() => {
    code = vi.fn()
    h = { view: vi.fn(() => ({ code })) }
    vi.clearAllMocks()
  })

  describe('getHubPage', () => {
    test('Should render the hub page with recently opened, saved, editing and awaiting approval guidance view models', async () => {
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
        })
      })
      expect(code).toHaveBeenCalledWith(statusCodes.HTTP_STATUS_OK)
    })
  })
})
