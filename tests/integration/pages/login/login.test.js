import { constants as statusCodes } from 'node:http2'

import nock from 'nock'

import { config } from '../../../../src/config/config.js'
import { createServer } from '../../../../src/server/server.js'
import { guidePageResponse, schemesResponse } from '../../../fixtures/guidance-api.js'
import { loginAsDevUser } from '../../helpers/login.js'

describe('#loginController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
    nock.disableNetConnect()
  })

  afterEach(() => {
    nock.cleanAll()
  })

  afterAll(async () => {
    nock.enableNetConnect()
    await server?.stop({ timeout: 0 })
  })

  describe('#loginAsDevUser', () => {
    test('Should set the session cookie as SameSite=Lax so it survives the cross-site redirect from Entra', async () => {
      const { headers } = await server.inject({
        method: 'GET',
        url: '/login'
      })

      const sessionCookie = (headers['set-cookie'] ?? []).find((c) => c.startsWith('sid='))

      expect(sessionCookie).toMatch(/SameSite=Lax/i)
    })

    test('Should establish a dev-session and redirect to /hub when hitting /login under the local provider', async () => {
      const callback = await server.inject({
        method: 'GET',
        url: '/login'
      })

      expect(callback.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(callback.headers.location).toBe('/hub')

      const cookie = (callback.headers['set-cookie'] ?? [])
        .map((c) => c.split(';')[0])
        .join('; ')
      expect(cookie).not.toBe('')

      // The hub lists the guides, showing each one's schemes by short label.
      nock(config.get('guidanceApi.baseUrl'))
        .get('/reference/schemes')
        .reply(statusCodes.HTTP_STATUS_OK, schemesResponse())
      nock(config.get('guidanceApi.baseUrl'))
        .get('/guides')
        .reply(statusCodes.HTTP_STATUS_OK, guidePageResponse())

      // Confirms the dev-session profile was actually stored against the
      // session (not just that a cookie was set) - it flows through to the
      // shared layout's header on the next request.
      const { statusCode, payload } = await server.inject({
        method: 'GET',
        url: '/hub',
        headers: { cookie }
      })

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_OK)
      expect(payload).toContain('Dev User')
    })

    test('Should not expose the Entra callback under the local provider', async () => {
      const { statusCode } = await server.inject({
        method: 'POST',
        url: '/login/callback'
      })

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_NOT_FOUND)
    })
  })

  describe('#logout', () => {
    test('Should end the session and redirect to / when authenticated', async () => {
      const cookie = await loginAsDevUser(server)

      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: '/logout',
        headers: { cookie }
      })

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(headers.location).toBe('/')

      // Confirms the cached session was actually dropped, not just the
      // cookie cleared client-side - reusing the original cookie against a
      // protected route should now be treated as unauthenticated.
      const reuse = await server.inject({
        method: 'GET',
        url: '/hub',
        headers: { cookie }
      })

      expect(reuse.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(reuse.headers.location).toBe('/')
    })

    test('Should redirect to / without requiring a session when not authenticated', async () => {
      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: '/logout'
      })

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(headers.location).toBe('/')
    })
  })
})
