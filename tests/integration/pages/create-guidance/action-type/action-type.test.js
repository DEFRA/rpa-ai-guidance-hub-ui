import { constants as statusCodes } from 'node:http2'

import { createServer } from '../../../../../src/server/server.js'
import { loginAsDevUser } from '../../../helpers/login.js'

describe('#actionTypeController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  describe('When logged in as a dev user', () => {
    test('GET /create-guidance/action-type renders the action selector', async () => {
      const cookie = await loginAsDevUser(server)

      const { statusCode, payload } = await server.inject({
        method: 'GET',
        url: '/create-guidance/action-type',
        headers: { cookie }
      })

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_OK)
      expect(payload).toContain('Choose what you want to do')
      expect(payload).toContain('Migrate an existing guidance')
    })

    test('POST /create-guidance/action-type re-renders with errors for invalid form data', async () => {
      const cookie = await loginAsDevUser(server)

      const { statusCode, payload } = await server.inject({
        method: 'POST',
        url: '/create-guidance/action-type',
        payload: {},
        headers: { cookie }
      })

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_BAD_REQUEST)
      expect(payload).toContain('There is a problem')
      expect(payload).toContain('Select an action')
    })

    test('POST /create-guidance/action-type with migrate redirects to start-upload', async () => {
      const cookie = await loginAsDevUser(server)

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: '/create-guidance/action-type',
        payload: { action: 'migrate' },
        headers: { cookie }
      })

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(headers.location).toBe('/create-guidance/start-upload')
    })
  })

  describe('When not logged in', () => {
    test('GET /create-guidance/action-type redirects to the home page', async () => {
      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: '/create-guidance/action-type'
      })

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(headers.location).toBe('/')
    })
  })
})
