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

      return { auth: { credentials }, server: { app: { cache: { set } } }, set }
    }

    test('answers the id the session keeps, without asking the API', async () => {
      const request = requestWith({ sessionId: 's-1', profile, token: 't', userId: HUB_ID })

      expect(await usersService.userIdOf(request)).toBe(HUB_ID)
      expect(usersApi.signIn).not.toHaveBeenCalled()
    })

    test('resolves a session from before sessions kept the id, and keeps it in the session from then on', async () => {
      answerSignIn()
      const request = requestWith({ sessionId: 's-1', profile, token: 't', refreshToken: 'r' })

      expect(await usersService.userIdOf(request)).toBe(HUB_ID)
      expect(request.set).toHaveBeenCalledWith('auth-session:s-1', { profile, token: 't', refreshToken: 'r', userId: HUB_ID })
    })
  })
})
