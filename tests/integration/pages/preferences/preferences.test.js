import { constants as statusCodes } from 'node:http2'

import nock from 'nock'

import { createServer } from '../../../../src/server/server.js'
import { loginAsDevUser } from '../../helpers/login.js'
import { keepPreferencesInTheApi } from '../../helpers/preferences-api.js'

describe('POST /preferences, which a page\'s script sends a change to', () => {
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
    return server.inject({ method: 'POST', url: '/preferences', headers: { cookie }, payload })
  }

  test('keeps the width of the contents pane or the side navigation', async () => {
    const response = await send({ contentsWidth: '412', sideNavWidth: '360' })

    expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_NO_CONTENT)
    expect(kept).toEqual({ contentsWidth: 412, sideNavWidth: 360 })
  })

  test('keeps whether each of the side navigation\'s lists is closed', async () => {
    const response = await send({ sideNavPinnedCollapsed: 'true', sideNavBookmarksCollapsed: 'false' })

    expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_NO_CONTENT)
    expect(kept).toEqual({ sideNavPinnedCollapsed: true, sideNavBookmarksCollapsed: false })
  })

  test.each([
    [{ sideNavPinnedCollapsed: 'shut' }],
    [{ contentsWidth: '239' }],
    [{ contentsWidth: '561' }],
    [{ sideNavWidth: '441' }],
    [{ sideNavWidth: 'wide' }],
    [{ fontSize: '12' }],
    [{}]
  ])('refuses %j', async (payload) => {
    const response = await send(payload)

    expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_BAD_REQUEST)
    expect(kept).toEqual({})
  })
})
