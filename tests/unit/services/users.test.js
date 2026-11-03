import * as usersApi from '../../../src/infra/guidance-api/users.js'
import * as usersService from '../../../src/services/users.js'

vi.mock('../../../src/infra/guidance-api/users.js')

const HUB_ID = '01a18d45-0000-7000-8000-000000000001'

const profile = { id: 'oid-1', tenantId: 'tenant-1', displayName: 'Test User', email: 'test@example.com' }

function answerSignIn () {
  usersApi.signIn.mockResolvedValue({ ok: true, status: 201, data: { id: HUB_ID } })
}

describe('users service', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  describe('signIn', () => {
    test('finds or makes the user by who signed in, and answers the hub\'s id for them', async () => {
      answerSignIn()

      expect(await usersService.signIn(profile)).toBe(HUB_ID)
      expect(usersApi.signIn).toHaveBeenCalledWith({ tenantId: 'tenant-1', objectId: 'oid-1', displayName: 'Test User' })
    })

    test('takes the hub\'s own Entra tenant for a profile from before profiles kept one', async () => {
      answerSignIn()

      await usersService.signIn({ id: 'oid-1', displayName: 'Test User' })

      expect(usersApi.signIn).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 'fake-tenant-id' }))
    })
  })

  describe('userIdOf', () => {
    function requestWith (credentials) {
      const set = vi.fn()

      return { auth: { credentials }, server: { app: { cache: { set } } }, app: {}, set }
    }

    test('answers the id the session keeps, without asking the API', async () => {
      const request = requestWith({ sessionId: 's-1', profile, token: 't', userId: HUB_ID })

      expect(await usersService.userIdOf(request)).toBe(HUB_ID)
      expect(usersApi.signIn).not.toHaveBeenCalled()
    })

    test('resolves it once for a request, however many parts of the page ask', async () => {
      answerSignIn()
      const request = requestWith({ sessionId: 's-1', profile, token: 't' })

      await Promise.all([usersService.userIdOf(request), usersService.userIdOf(request)])

      expect(usersApi.signIn).toHaveBeenCalledTimes(1)
    })

    test('resolves a session from before sessions kept the id, and keeps it in the session from then on', async () => {
      answerSignIn()
      const request = requestWith({ sessionId: 's-1', profile, token: 't', refreshToken: 'r' })

      expect(await usersService.userIdOf(request)).toBe(HUB_ID)
      expect(request.set).toHaveBeenCalledWith('auth-session:s-1', { profile, token: 't', refreshToken: 'r', userId: HUB_ID })
    })
  })

  describe('the user\'s pinned guides', () => {
    const PINNED = [{ id: 'guide-2', title: 'Closing a case' }, { id: 'guide-1', title: 'Claiming' }]

    function signedInRequest () {
      return { auth: { credentials: { sessionId: 's-1', profile, token: 't', userId: HUB_ID } }, app: {} }
    }

    test('come with the user\'s record, which a page asks for once', async () => {
      usersApi.getUser.mockResolvedValue({ ok: true, status: 200, data: { id: HUB_ID, pinned: PINNED } })
      const request = signedInRequest()

      expect(await usersService.pinnedOf(request)).toEqual(PINNED)
      expect(await usersService.pinnedOf(request)).toEqual(PINNED)
      expect(usersApi.getUser).toHaveBeenCalledTimes(1)
      expect(usersApi.getUser).toHaveBeenCalledWith(HUB_ID)
    })

    test('are not known when the user cannot be had, rather than failing the page', async () => {
      usersApi.getUser.mockRejectedValue(new Error('API unavailable'))

      expect(await usersService.pinnedOf(signedInRequest())).toBeNull()
    })

    test('a guide is pinned at the top', async () => {
      usersApi.patchPins.mockResolvedValue({ ok: true, status: 204 })

      await usersService.pin(signedInRequest(), 'guide-3')

      expect(usersApi.patchPins).toHaveBeenCalledWith(HUB_ID, [{ op: 'add', path: '/0', value: 'guide-3' }])
    })

    test('a guide is moved from where the page showed it, if it is still there', async () => {
      usersApi.patchPins.mockResolvedValue({ ok: true, status: 204 })

      await usersService.movePin(signedInRequest(), 'guide-2', 0, 1)

      expect(usersApi.patchPins).toHaveBeenCalledWith(HUB_ID, [
        { op: 'test', path: '/0', value: 'guide-2' },
        { op: 'move', from: '/0', path: '/1' }
      ])
    })

    test('a guide is unpinned from where the page showed it, if it is still there', async () => {
      usersApi.patchPins.mockResolvedValue({ ok: true, status: 204 })

      await usersService.unpin(signedInRequest(), 'guide-1', 1)

      expect(usersApi.patchPins).toHaveBeenCalledWith(HUB_ID, [
        { op: 'test', path: '/1', value: 'guide-1' },
        { op: 'remove', path: '/1' }
      ])
    })
  })
})
