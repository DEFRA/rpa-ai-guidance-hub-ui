import { constants as statusCodes } from 'node:http2'

import { createServer } from '../../../../../src/server/server.js'
import { loginAsDevUser } from '../../../helpers/login.js'

function validFormPayload (overrides = {}) {
  return {
    guidanceType: 'process',
    title: 'Submit your claim',
    intendedAudience: 'RPA caseworkers',
    intendedOutcome: 'Complete and submit the claim accurately',
    userPrerequisites: 'Understand claim eligibility criteria',
    requiresSystemAccess: 'no',
    systemAccessDetails: '',
    ...overrides
  }
}

describe('#addMetadataController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  describe('When logged in as a dev user', () => {
    test('GET /create-guidance/add-metadata renders the metadata form', async () => {
      const cookie = await loginAsDevUser(server)

      const { statusCode, payload } = await server.inject({
        method: 'GET',
        url: '/create-guidance/add-metadata',
        headers: { cookie }
      })

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_OK)
      expect(payload).toContain('Capture guidance metadata')
      expect(payload).toContain('Type of guidance')
    })

    test('POST /create-guidance/add-metadata re-renders with errors for invalid form data', async () => {
      const cookie = await loginAsDevUser(server)

      const { statusCode, payload } = await server.inject({
        method: 'POST',
        url: '/create-guidance/add-metadata',
        payload: {},
        headers: { cookie }
      })

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_BAD_REQUEST)
      expect(payload).toContain('There is a problem')
      expect(payload).toContain('Select the type of guidance')
    })

    test('POST /create-guidance/add-metadata requires conditional system access details', async () => {
      const cookie = await loginAsDevUser(server)

      const { statusCode, payload } = await server.inject({
        method: 'POST',
        url: '/create-guidance/add-metadata',
        payload: validFormPayload({
          requiresSystemAccess: 'yes',
          systemAccessDetails: ''
        }),
        headers: { cookie }
      })

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_BAD_REQUEST)
      expect(payload).toContain('Enter which systems users need access to')
    })

    test('POST /create-guidance/add-metadata saves metadata to session and redirects to the dashboard', async () => {
      const cookie = await loginAsDevUser(server)

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: '/create-guidance/add-metadata',
        payload: validFormPayload({
          requiresSystemAccess: 'yes',
          systemAccessDetails: 'Rural Payments service'
        }),
        headers: { cookie }
      })

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(headers.location).toBe('/designer/dashboard')
    })
  })

  describe('When not logged in', () => {
    test('GET /create-guidance/add-metadata redirects to the home page', async () => {
      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: '/create-guidance/add-metadata'
      })

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(headers.location).toBe('/')
    })
  })
})
