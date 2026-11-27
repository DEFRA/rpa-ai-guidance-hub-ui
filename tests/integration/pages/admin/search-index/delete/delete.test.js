import { constants as statusCodes } from 'node:http2'

import nock from 'nock'

import { config } from '../../../../../../src/config/config.js'
import { createServer } from '../../../../../../src/server/server.js'
import { findTheUserInTheApi } from '../../../../helpers/admin-api.js'
import { mergeCookies } from '../../../../helpers/cookies.js'
import { loginAsDevUser } from '../../../../helpers/login.js'
import { pageOf } from '../../../../helpers/page.js'
import { searchIndexDeletedResponse } from '../../../../../fixtures/guidance-api.js'

const GUIDANCE_API_URL = config.get('guidanceApi.baseUrl')
const DELETE_URL = '/admin/search-index/delete'
const SEARCH_INDEX_URL = '/admin/search-index'

describe('Delete search index page', () => {
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
      url: DELETE_URL,
      headers: { cookie },
      payload: {}
    })
  }

  async function searchIndexPageAfter (deleted) {
    const response = await server.inject({
      method: 'GET',
      url: SEARCH_INDEX_URL,
      headers: { cookie: mergeCookies(cookie, deleted.headers['set-cookie']) }
    })

    return pageOf(response.payload)
  }

  describe('GET /admin/search-index/delete', () => {
    test('asks for confirmation, with a warning, a delete button and a way out', async () => {
      const response = await server.inject({
        method: 'GET',
        url: DELETE_URL,
        headers: { cookie }
      })

      const page = pageOf(response.payload)
      expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_OK)
      expect(page.getByRole('heading', { level: 1, name: 'Are you sure you want to delete the search index?' }))
        .toBeInTheDocument()
      expect(page.getByText('Search will show no results until you rebuild the index.', { exact: false }))
        .toBeInTheDocument()
      expect(page.getByRole('button', { name: 'Yes, delete the search index' }))
        .toHaveAttribute('data-prevent-double-click', 'true')
      expect(page.getByRole('link', { name: 'Cancel' }))
        .toHaveAttribute('href', SEARCH_INDEX_URL)
    })
  })

  describe('POST /admin/search-index/delete', () => {
    describe('when search is deleted', () => {
      let deleted

      beforeEach(async () => {
        nock(GUIDANCE_API_URL)
          .matchHeader('x-requested-by', user.id)
          .delete(SEARCH_INDEX_URL)
          .reply(statusCodes.HTTP_STATUS_OK, searchIndexDeletedResponse())

        deleted = await post()
      })

      test('redirects to the search index page', () => {
        expect(deleted.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
        expect(deleted.headers.location).toBe(SEARCH_INDEX_URL)
      })

      test('says so there, and offers the rebuild in the banner', async () => {
        const page = await searchIndexPageAfter(deleted)

        expect(page.getByText('Search index deleted. Search will show no results until you rebuild it.'))
          .toBeInTheDocument()
        expect(page.getAllByRole('button', { name: 'Rebuild search index' }))
          .toHaveLength(2)
      })
    })

    describe('when search failed to delete', () => {
      let failed

      beforeEach(async () => {
        nock(GUIDANCE_API_URL)
          .delete(SEARCH_INDEX_URL)
          .reply(statusCodes.HTTP_STATUS_BAD_GATEWAY, {})

        failed = await post()
      })

      test('redirects to the search index page', () => {
        expect(failed.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
        expect(failed.headers.location).toBe(SEARCH_INDEX_URL)
      })

      test('says it could not be deleted, and does not say it was', async () => {
        const page = await searchIndexPageAfter(failed)

        expect(page.getByText('The search index could not be deleted. Try again.'))
          .toBeInTheDocument()
        expect(page.queryByText(/Search index deleted/)).not.toBeInTheDocument()
      })
    })

    test('shows the error page when the API fails any other way', async () => {
      nock(GUIDANCE_API_URL)
        .delete(SEARCH_INDEX_URL)
        .reply(statusCodes.HTTP_STATUS_INTERNAL_SERVER_ERROR, {})

      const response = await post()

      expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_INTERNAL_SERVER_ERROR)
    })
  })
})
