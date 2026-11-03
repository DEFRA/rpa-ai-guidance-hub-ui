import { statusCodes } from '../../../../src/constants/status-codes.js'
import * as controller from '../../../../src/pages/pins/controller.js'
import * as usersService from '../../../../src/services/users.js'

const GUIDE = '0199b8a2-4c1e-7b3a-9d2f-6a1e3c5b7d90'

describe('pins controller', () => {
  let h, code

  beforeEach(() => {
    vi.restoreAllMocks()
    code = vi.fn(() => 'answered')
    h = { redirect: vi.fn(() => 'redirected'), response: vi.fn(() => ({ code })) }
    vi.spyOn(usersService, 'pin').mockResolvedValue(true)
    vi.spyOn(usersService, 'unpin').mockResolvedValue(true)
    vi.spyOn(usersService, 'movePin').mockResolvedValue(true)
  })

  describe('postPinToggle', () => {
    test('pins the guide, then goes back to the page, to the guide\'s star', async () => {
      const request = { payload: { guideId: GUIDE, pin: true, returnTo: '/hub?system=CRM#top', anchor: `pin-${GUIDE}` } }

      await controller.postPinToggle(request, h)

      expect(usersService.pin).toHaveBeenCalledWith(request, GUIDE)
      expect(h.redirect).toHaveBeenCalledWith(`/hub?system=CRM#pin-${GUIDE}`)
    })

    test('unpins the guide from where the page showed it', async () => {
      const request = { payload: { guideId: GUIDE, pin: false, position: 2, returnTo: '/hub' } }

      await controller.postPinToggle(request, h)

      expect(usersService.unpin).toHaveBeenCalledWith(request, GUIDE, 2)
      expect(h.redirect).toHaveBeenCalledWith('/hub')
    })

    test('does not go to another site', async () => {
      await controller.postPinToggle({ payload: { guideId: GUIDE, pin: true, returnTo: 'https://evil.example' } }, h)

      expect(h.redirect).toHaveBeenCalledWith('/hub')
    })
  })

  describe('postPinOrder', () => {
    test('moves the guide from where the page showed it, then goes back to the pinned guides', async () => {
      const request = { payload: { guideId: GUIDE, from: 0, to: 1, returnTo: '/hub' } }

      await controller.postPinOrder(request, h)

      expect(usersService.movePin).toHaveBeenCalledWith(request, GUIDE, 0, 1)
      expect(h.redirect).toHaveBeenCalledWith('/hub#side-nav-pinned')
    })

    test.each([
      ['nothing to show once it is moved', true, statusCodes.HTTP_STATUS_NO_CONTENT],
      ['a conflict when the pins changed since the page showed them', false, statusCodes.HTTP_STATUS_CONFLICT]
    ])('answers a script, which sends no page to go back to, with %s', async (_answer, moved, status) => {
      usersService.movePin.mockResolvedValue(moved)

      const response = await controller.postPinOrder({ payload: { guideId: GUIDE, from: 1, to: 0, returnTo: '' } }, h)

      expect(code).toHaveBeenCalledWith(status)
      expect(response).toBe('answered')
    })
  })
})
