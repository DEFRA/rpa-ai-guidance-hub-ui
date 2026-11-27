import { constants as statusCodes } from 'node:http2'

import nock from 'nock'

import { config } from '../../../../../../src/config/config.js'
import { createServer } from '../../../../../../src/server/server.js'
import { findTheUserInTheApi } from '../../../../helpers/admin-api.js'
import { mergeCookies } from '../../../../helpers/cookies.js'
import { loginAsDevUser } from '../../../../helpers/login.js'
import { pageOf } from '../../../../helpers/page.js'

const GUIDANCE_API_URL = config.get('guidanceApi.baseUrl')
const REBUILD_URL = '/admin/search-index/rebuild'
const SEARCH_INDEX_URL = '/admin/search-index'

describe('Rebuild search index page', () => {
  let server
  let user
  let cookie

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop()
  })

  beforeEach(async () => {
    vi.stubEnv('DEV_USER_ROLES', 'Hub.Viewer,Hub.Admin')
    user = findTheUserInTheApi()
    cookie = await loginAsDevUser(server)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    nock.cleanAll()
  })

  function post () {
    return server.inject({
      method: 'POST',
      url: REBUILD_URL,
      headers: { cookie },
      payload: {}
    })
  }

  async function searchIndexPage (sessionCookie) {
    const response = await server.inject({
      method: 'GET',
      url: SEARCH_INDEX_URL,
      headers: { cookie: sessionCookie }
    })

    return { response, page: pageOf(response.payload) }
  }

  describe('GET /admin/search-index/rebuild', () => {
    test('asks for confirmation, with a rebuild button and a way out', async () => {
      const response = await server.inject({
        method: 'GET',
        url: REBUILD_URL,
        headers: { cookie }
      })

      const page = pageOf(response.payload)
      expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_OK)
      expect(page.getByRole('heading', { level: 1, name: 'Are you sure you want to rebuild the search index?' }))
        .toBeInTheDocument()
      expect(page.getByRole('button', { name: 'Yes, rebuild the search index' }))
        .toHaveAttribute('data-prevent-double-click', 'true')
      expect(page.getByRole('link', { name: 'Cancel' }))
        .toHaveAttribute('href', SEARCH_INDEX_URL)
    })

    test('does not rebuild anything', async () => {
      const api = nock(GUIDANCE_API_URL)
        .post(REBUILD_URL)
        .reply(statusCodes.HTTP_STATUS_CREATED, {})

      await server.inject({ method: 'GET', url: REBUILD_URL, headers: { cookie } })

      expect(api.isDone()).toBe(false)
    })
  })

  describe('POST /admin/search-index/rebuild', () => {
    describe('when the API accepts the rebuild', () => {
      let rebuild

      beforeEach(async () => {
        nock(GUIDANCE_API_URL)
          .post(REBUILD_URL, { requestedBy: user.id })
          .reply(statusCodes.HTTP_STATUS_CREATED, {})

        rebuild = await post()
      })

      test('redirects to the index management page', () => {
        expect(rebuild.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
        expect(rebuild.headers.location).toBe(SEARCH_INDEX_URL)
      })

      test('says the index is being rebuilt, once', async () => {
        const after = mergeCookies(cookie, rebuild.headers['set-cookie'])

        const first = await searchIndexPage(after)
        const again = await searchIndexPage(
          mergeCookies(after, first.response.headers['set-cookie'])
        )

        expect(first.page.getByText('The search index is being rebuilt. Guides will appear in search results over the next few minutes.'))
          .toBeInTheDocument()
        expect(again.page.queryByText(/is being rebuilt/)).not.toBeInTheDocument()
      })
    })

    test('shows the error page when the API fails', async () => {
      nock(GUIDANCE_API_URL)
        .post(REBUILD_URL)
        .reply(statusCodes.HTTP_STATUS_INTERNAL_SERVER_ERROR, {})

      const response = await post()

      expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_INTERNAL_SERVER_ERROR)
    })
  })
})
