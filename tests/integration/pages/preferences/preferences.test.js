import { constants as statusCodes } from 'node:http2'

import nock from 'nock'

import { config } from '../../../../src/config/config.js'
import { createServer } from '../../../../src/server/server.js'
import { userResponse } from '../../../fixtures/guidance-api.js'
import { loginAsDevUser } from '../../helpers/login.js'
import { keepPreferencesInTheApi } from '../../helpers/preferences-api.js'

describe('POST /preferences', () => {
  let server, cookie, kept

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
    nock.disableNetConnect()
  })

  beforeEach(async () => {
    kept = keepPreferencesInTheApi()
    cookie = await loginAsDevUser(server)
  })

  afterEach(() => {
    nock.cleanAll()
  })

  afterAll(async () => {
    nock.enableNetConnect()
    await server.stop({ timeout: 0 })
  })

  function send (payload) {
    return server.inject({
      method: 'POST',
      url: '/preferences',
      headers: { cookie },
      payload
    })
  }

  test('keeps the widths of both panes', async () => {
    const response = await send({ contentsWidth: '412', sideNavWidth: '360' })

    expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_NO_CONTENT)
    expect(kept).toEqual({ contentsWidth: 412, sideNavWidth: 360 })
  })

  test('keeps whether each side navigation list is closed', async () => {
    const response = await send({
      sideNavPinnedCollapsed: 'true',
      sideNavBookmarksCollapsed: 'false'
    })

    expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_NO_CONTENT)
    expect(kept).toEqual({
      sideNavPinnedCollapsed: true,
      sideNavBookmarksCollapsed: false
    })
  })

  test.each([
    [{ sideNavPinnedCollapsed: 'shut' }],
    [{ contentsWidth: '239' }],
    [{ contentsWidth: '561' }],
    [{ sideNavWidth: '441' }],
    [{ sideNavWidth: 'wide' }],
    [{ fontSize: '12' }],
    [{}]
  ])('refuses %j, keeping nothing', async (payload) => {
    const response = await send(payload)

    expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_BAD_REQUEST)
    expect(kept).toEqual({})
  })

  test('fails when the hub cannot keep the change', async () => {
    nock.cleanAll()
    nock(config.get('guidanceApi.baseUrl'))
      .persist()
      .post('/users').reply(statusCodes.HTTP_STATUS_OK, userResponse())
      .patch(/^\/preferences\//)
      .reply(statusCodes.HTTP_STATUS_SERVICE_UNAVAILABLE)

    const response = await send({ sideNavWidth: '360' })

    expect(response.statusCode)
      .toBe(statusCodes.HTTP_STATUS_INTERNAL_SERVER_ERROR)
  })
})
