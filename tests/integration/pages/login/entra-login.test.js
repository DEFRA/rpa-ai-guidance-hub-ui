import { constants as statusCodes } from 'node:http2'

import nock from 'nock'

import { guidePageResponse } from '../../../fixtures/guidance-api.js'
import { generateEntraJwt, getJwks } from '../../../utils/oidc.js'

const ENTRA_HOST = 'https://login.microsoftonline.com'
const TENANT_PATH = '/fake-tenant-id'
const USER_OID = '00000000-0000-0000-0000-000000000123'

function cookieHeader (response) {
  return (response.headers['set-cookie'] ?? [])
    .map((cookie) => cookie.split(';')[0])
    .join('; ')
}

function getCallback (server, { cookie, params }) {
  return server.inject({
    method: 'GET',
    url: `/login/callback?${new URLSearchParams(params)}`,
    headers: { cookie }
  })
}

function postCallback (server, { cookie, params }) {
  return server.inject({
    method: 'POST',
    url: '/login/callback',
    headers: { 'content-type': 'application/x-www-form-urlencoded', cookie },
    payload: new URLSearchParams(params).toString()
  })
}

describe('#loginController under the entra provider', () => {
  let server
  let config

  beforeAll(async () => {
    vi.stubEnv('AUTH_PROVIDER', 'entra')
    vi.resetModules()

    const { createServer } = await import('../../../../src/server/server.js')

    ;({ config } = await import('../../../../src/config/config.js'))

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
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  describe.each([
    ['GET', getCallback],
    ['POST', postCallback]
  ])('a successful sign-in via a %s callback', (_method, sendCallback) => {
    test('Should redirect to /hub, where the new session is accepted and the Entra profile is shown', async () => {
      const login = await server.inject({ method: 'GET', url: '/login' })
      const authorizeUrl = new URL(login.headers.location)
      const state = authorizeUrl.searchParams.get('state')
      const nonce = authorizeUrl.searchParams.get('nonce')

      nock(ENTRA_HOST)
        .post(`${TENANT_PATH}/oauth2/v2.0/token`)
        .reply(statusCodes.HTTP_STATUS_OK, {
          access_token: generateEntraJwt(),
          refresh_token: 'refresh-token',
          id_token: generateEntraJwt({ nonce, oid: USER_OID })
        })
      nock(ENTRA_HOST)
        .get(`${TENANT_PATH}/discovery/v2.0/keys`)
        .reply(statusCodes.HTTP_STATUS_OK, getJwks())

      const callback = await sendCallback(server, {
        cookie: cookieHeader(login),
        params: { code: 'auth-code', state }
      })

      expect(callback.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(callback.headers.location).toBe('/hub')

      nock(config.get('guidanceApi.baseUrl'))
        .get('/guides')
        .reply(statusCodes.HTTP_STATUS_OK, guidePageResponse())

      const hub = await server.inject({
        method: 'GET',
        url: '/hub',
        headers: { cookie: cookieHeader(callback) }
      })

      expect(hub.statusCode).toBe(statusCodes.HTTP_STATUS_OK)
      expect(hub.payload).toContain('Test User')
    })
  })
})
