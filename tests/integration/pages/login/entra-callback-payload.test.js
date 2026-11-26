import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import Hapi from '@hapi/hapi'
import HapiCookie from '@hapi/cookie'
import nock from 'nock'

import { generateEntraJwt, getJwks } from '../../../utils/oidc.js'

const { mockLoggerWarn, mockLoggerError } = vi.hoisted(() => ({
  mockLoggerWarn: vi.fn(),
  mockLoggerError: vi.fn()
}))

vi.mock('../../../../src/infra/logging/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: mockLoggerWarn,
    error: mockLoggerError
  })
}))

const ENTRA_HOST = 'https://login.microsoftonline.com'
const TENANT_PATH = '/fake-tenant-id'
const USER_OID = '00000000-0000-0000-0000-000000000123'
const GENERIC_MESSAGE = 'Authentication failed. Please try again.'
const FORM = 'application/x-www-form-urlencoded'

async function buildServer () {
  const { auth } = await import('../../../../src/server/plugins/auth/auth.js')
  const { routes } = await import('../../../../src/pages/login/routes.js')

  const server = Hapi.server()

  server.app.cache = server.cache({ segment: 'auth-session', expiresIn: 60_000 })

  await server.register(HapiCookie)
  await server.register(auth)

  server.route(routes)

  await server.initialize()

  return server
}

function cookieHeader (response) {
  return (response.headers['set-cookie'] ?? [])
    .map((cookie) => cookie.split(';')[0])
    .join('; ')
}

async function startLogin (server) {
  const response = await server.inject({ method: 'GET', url: '/login' })
  const location = new URL(response.headers.location)

  return {
    state: location.searchParams.get('state'),
    nonce: location.searchParams.get('nonce'),
    cookie: cookieHeader(response)
  }
}

/**
 * POST to the callback. `options.payload` is sent as given: a string is a
 * raw form body, an object is sent as JSON.
 */
function postCallback (server, options) {
  return server.inject({
    method: 'POST',
    url: '/login/callback',
    headers: {
      ...(options.contentType ? { 'content-type': options.contentType } : {}),
      cookie: options.cookie
    },
    payload: options.payload
  })
}

function mockTokenEndpoint () {
  return nock(ENTRA_HOST)
    .post(`${TENANT_PATH}/oauth2/v2.0/token`)
    .reply(200, {})
}

function expectRejectedAsInvalid (callback, tokenScope) {
  expect(callback.statusCode).toBe(401)
  expect(callback.result.message).toBe(GENERIC_MESSAGE)
  expect(tokenScope.isDone()).toBe(false)
  expect(callback.headers['set-cookie']).toEqual(
    expect.arrayContaining([expect.stringMatching(/^entra-oidc=; Max-Age=0/)])
  )
  expect(mockLoggerError).not.toHaveBeenCalled()
  expect(mockLoggerWarn).toHaveBeenCalledWith(
    expect.objectContaining({
      event: expect.objectContaining({ type: 'entra_callback_invalid', outcome: 'failure' })
    }),
    expect.stringContaining('Entra callback failed:')
  )
}

describe('#handleEntraCallback payload validation', () => {
  let server

  beforeEach(async () => {
    vi.stubEnv('AUTH_PROVIDER', 'entra')
    vi.resetModules()
    mockLoggerWarn.mockClear()
    mockLoggerError.mockClear()
    nock.disableNetConnect()

    server = await buildServer()
  })

  afterEach(async () => {
    await server.stop({ timeout: 0 })
    nock.cleanAll()
    nock.enableNetConnect()
    vi.unstubAllEnvs()
  })

  test('rejects and logs a callback with no body, and clears the OIDC state cookie', async () => {
    const { cookie } = await startLogin(server)
    const tokenScope = mockTokenEndpoint()

    const callback = await postCallback(server, { cookie })

    expectRejectedAsInvalid(callback, tokenScope)
  })

  test.each([
    ['code', 'secret-auth-code&code=second-secret-code'],
    ['state', 'secret-state-value&state=second-secret-state']
  ])('rejects a repeated %s form field without logging what was sent', async (field, repeated) => {
    const { cookie } = await startLogin(server)
    const tokenScope = mockTokenEndpoint()
    const other = field === 'code' ? 'state=other-state' : 'code=other-code'

    const callback = await postCallback(server, {
      cookie,
      contentType: FORM,
      payload: `${field}=${repeated}&${other}`
    })

    expectRejectedAsInvalid(callback, tokenScope)

    const logged = JSON.stringify(mockLoggerWarn.mock.calls)

    expect(logged).not.toContain('secret-auth-code')
    expect(logged).not.toContain('second-secret-code')
    expect(logged).not.toContain('secret-state-value')
    expect(logged).not.toContain('second-secret-state')
  })

  describe.each([
    ['code'],
    ['state'],
    ['error'],
    ['error_description']
  ])('a non-string %s in a JSON body', (field) => {
    test.each([
      ['a number', 12345],
      ['a boolean', true],
      ['an array', ['secret-value']],
      ['an object', { secret: 'secret-value' }]
    ])('is rejected when it is %s', async (_description, value) => {
      const { cookie } = await startLogin(server)
      const tokenScope = mockTokenEndpoint()

      const callback = await postCallback(server, {
        cookie,
        payload: { code: 'auth-code', state: 'a-state', [field]: value }
      })

      expectRejectedAsInvalid(callback, tokenScope)
      expect(JSON.stringify(mockLoggerWarn.mock.calls)).not.toContain('secret-value')
    })
  })

  test('accepts the other fields Entra may post, such as session_state', async () => {
    const { state, nonce, cookie } = await startLogin(server)

    const tokens = {
      access_token: generateEntraJwt(),
      id_token: generateEntraJwt({ nonce, oid: USER_OID })
    }

    nock(ENTRA_HOST)
      .post(`${TENANT_PATH}/oauth2/v2.0/token`)
      .reply(200, tokens)
    nock(ENTRA_HOST)
      .get(`${TENANT_PATH}/discovery/v2.0/keys`)
      .reply(200, getJwks())

    const callback = await postCallback(server, {
      cookie,
      contentType: FORM,
      payload: new URLSearchParams({ code: 'auth-code', state, session_state: 'entra-session' }).toString()
    })

    expect(callback.statusCode).toBe(302)
    expect(callback.headers.location).toBe('/hub')
  })

  test('does not accept the authorization response on a query string', async () => {
    const { state, cookie } = await startLogin(server)
    const tokenScope = mockTokenEndpoint()

    const callback = await server.inject({
      method: 'GET',
      url: `/login/callback?${new URLSearchParams({ code: 'auth-code', state })}`,
      headers: { cookie }
    })

    expect(callback.statusCode).toBe(404)
    expect(tokenScope.isDone()).toBe(false)
  })
})
