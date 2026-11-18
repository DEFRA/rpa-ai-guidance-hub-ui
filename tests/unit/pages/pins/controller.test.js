import { statusCodes } from '../../../../src/constants/status-codes.js'
import * as controller from '../../../../src/pages/pins/controller.js'
import * as guidesService from '../../../../src/services/guides.js'
import * as usersService from '../../../../src/services/users.js'

const GUIDE = '0199b8a2-4c1e-7b3a-9d2f-6a1e3c5b7d90'
const OTHER = '0199b8a2-4c1e-7b3a-9d2f-6a1e3c5b7d91'

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

      expect(usersService.pin).toHaveBeenCalledWith(request, GUIDE, null)
      expect(h.redirect).toHaveBeenCalledWith(`/hub?system=CRM#pin-${GUIDE}`)
    })

    test('unpins the guide from where the page showed it', async () => {
      const request = { payload: { guideId: GUIDE, pin: false, position: 2, returnTo: '/hub' } }

      await controller.postPinToggle(request, h)

      expect(usersService.unpin).toHaveBeenCalledWith(request, GUIDE, 2, null)
      expect(h.redirect).toHaveBeenCalledWith('/hub')
    })

    test('pins a section by its anchor, with its heading as the guide has it now, then goes back to the heading', async () => {
      vi.spyOn(guidesService, 'headingOf').mockResolvedValue({ anchor: 'før-you-begin', title: 'Før you begin', page: 1 })
      const request = { payload: { guideId: GUIDE, pin: true, section: 'før-you-begin', anchor: 'før-you-begin', returnTo: `/guides/${GUIDE}?page=1` } }

      await controller.postPinToggle(request, h)

      expect(guidesService.headingOf).toHaveBeenCalledWith(GUIDE, 'før-you-begin')
      expect(usersService.pin).toHaveBeenCalledWith(request, GUIDE, { section: 'før-you-begin', heading: 'Før you begin' })
      expect(h.redirect).toHaveBeenCalledWith(`/guides/${GUIDE}?page=1#f%C3%B8r-you-begin`)
    })

    test('goes back to the heading\'s anchor on the page, which a repeated heading makes differ from its section\'s', async () => {
      vi.spyOn(guidesService, 'headingOf').mockResolvedValue({ anchor: 'help-1', slug: 'help-3', title: 'Help', page: 2 })
      const request = { payload: { guideId: GUIDE, pin: true, section: 'help-1', anchor: 'help-3', returnTo: `/guides/${GUIDE}?page=2` } }

      await controller.postPinToggle(request, h)

      expect(usersService.pin).toHaveBeenCalledWith(request, GUIDE, { section: 'help-1', heading: 'Help' })
      expect(h.redirect).toHaveBeenCalledWith(`/guides/${GUIDE}?page=2#help-3`)
    })

    test('refuses to pin a section the guide does not have', async () => {
      vi.spyOn(guidesService, 'headingOf').mockResolvedValue(null)
      const request = { payload: { guideId: GUIDE, pin: true, section: 'gone', returnTo: '/hub' } }

      await expect(controller.postPinToggle(request, h)).rejects.toMatchObject({ output: { statusCode: statusCodes.HTTP_STATUS_NOT_FOUND } })

      expect(usersService.pin).not.toHaveBeenCalled()
    })

    test('unpins a section from where the page showed it, then goes back to its heading', async () => {
      const request = { payload: { guideId: GUIDE, pin: false, position: 1, sectionId: OTHER, section: 'assign-case', anchor: 'assign-case', returnTo: `/guides/${GUIDE}?page=2` } }

      await controller.postPinToggle(request, h)

      expect(usersService.unpin).toHaveBeenCalledWith(request, GUIDE, 1, OTHER)
      expect(h.redirect).toHaveBeenCalledWith(`/guides/${GUIDE}?page=2#assign-case`)
    })

    test('does not go to another site', async () => {
      await controller.postPinToggle({ payload: { guideId: GUIDE, pin: true, returnTo: 'https://evil.example' } }, h)

      expect(h.redirect).toHaveBeenCalledWith('/hub')
    })
  })

  describe('postPinOrder', () => {
    test('moves the guide from where the page showed it, then goes back to the pinned guides', async () => {
      const request = { payload: { order: [GUIDE, OTHER], from: 0, to: 1, returnTo: '/hub' } }

      await controller.postPinOrder(request, h)

      expect(usersService.movePin).toHaveBeenCalledWith(request, [GUIDE, OTHER], 0, 1)
      expect(h.redirect).toHaveBeenCalledWith('/hub#side-nav-pinned')
    })

    test.each([
      ['nothing to show once it is moved', true, statusCodes.HTTP_STATUS_NO_CONTENT],
      ['a conflict when the pins changed since the page showed them', false, statusCodes.HTTP_STATUS_CONFLICT]
    ])('answers a script, which sends no page to go back to, with %s', async (_answer, moved, status) => {
      usersService.movePin.mockResolvedValue(moved)

      const response = await controller.postPinOrder({ payload: { order: [GUIDE, OTHER], from: 1, to: 0, returnTo: '' } }, h)

      expect(code).toHaveBeenCalledWith(status)
      expect(response).toBe('answered')
    })
  })
})
