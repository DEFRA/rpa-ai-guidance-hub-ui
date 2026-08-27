import { constants as statusCodes } from 'node:http2'

import { createServer } from '../../../../src/server/server.js'
import { loginAsDevUser } from '../../helpers/login.js'

describe('#loginController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  describe('#handleLoginCallback', () => {
    test('Should establish a dev-session and redirect to /designer/dashboard when hitting the callback under the local provider', async () => {
      const callback = await server.inject({
        method: 'GET',
        url: '/login/callback'
      })

      expect(callback.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(callback.headers.location).toBe('/designer/dashboard')

      const cookie = (callback.headers['set-cookie'] ?? [])
        .map((c) => c.split(';')[0])
        .join('; ')
      expect(cookie).not.toBe('')

      // Confirms the dev-session profile was actually stored against the
      // session (not just that a cookie was set) - it flows through to the
      // shared layout's header on the next request.
      const { statusCode, payload } = await server.inject({
        method: 'GET',
        url: '/designer/dashboard',
        headers: { cookie }
      })

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_OK)
      expect(payload).toContain('Dev User')
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
        url: '/designer/dashboard',
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
