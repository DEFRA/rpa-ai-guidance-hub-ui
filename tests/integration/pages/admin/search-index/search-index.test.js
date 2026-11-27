import { constants as statusCodes } from 'node:http2'

import nock from 'nock'

import { config } from '../../../../../src/config/config.js'
import { createServer } from '../../../../../src/server/server.js'
import { findTheUserInTheApi } from '../../../helpers/admin-api.js'
import { mergeCookies } from '../../../helpers/cookies.js'
import { loginAsDevUser } from '../../../helpers/login.js'
import { pageOf } from '../../../helpers/page.js'
import { searchIndexDeletedResponse } from '../../../../fixtures/guidance-api.js'

const SEARCH_INDEX_URL = '/admin/search-index'

describe('Index management page', () => {
  let server
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
    findTheUserInTheApi()
    cookie = await loginAsDevUser(server)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    nock.cleanAll()
  })

  async function getPage (sessionCookie) {
    const response = await server.inject({
      method: 'GET',
      url: SEARCH_INDEX_URL,
      headers: { cookie: sessionCookie }
    })

    return { response, page: pageOf(response.payload) }
  }

  describe('GET /admin/search-index', () => {
    test('explains both operations, each with its own button to its confirm page', async () => {
      const { page } = await getPage(cookie)

      expect(page.getByRole('heading', { level: 1, name: 'Index management' }))
        .toBeInTheDocument()
      expect(page.getByRole('heading', { level: 2, name: 'Rebuild search index' }))
        .toBeInTheDocument()
      expect(page.getByRole('heading', { level: 2, name: 'Delete search index' }))
        .toBeInTheDocument()
      expect(page.getByRole('button', { name: 'Rebuild search index' }))
        .toHaveAttribute('href', '/admin/search-index/rebuild')
      expect(page.getByRole('button', { name: 'Delete search index' }))
        .toHaveAttribute('href', '/admin/search-index/delete')
    })

    test('puts the rebuild above the delete', async () => {
      const { page } = await getPage(cookie)

      const rebuild = page.getByRole('heading', { level: 2, name: 'Rebuild search index' })
      const remove = page.getByRole('heading', { level: 2, name: 'Delete search index' })
      expect(rebuild.compareDocumentPosition(remove))
        .toBe(rebuild.ownerDocument.defaultView.Node.DOCUMENT_POSITION_FOLLOWING)
    })

    test('shows no banner when nothing has been done', async () => {
      const { page } = await getPage(cookie)

      expect(page.queryByRole('region', { name: 'Success' })).not.toBeInTheDocument()
      expect(page.queryByRole('alert')).not.toBeInTheDocument()
    })

    test('shows the latest outcome when several were flashed before it was loaded', async () => {
      nock(config.get('guidanceApi.baseUrl'))
        .delete(SEARCH_INDEX_URL)
        .reply(statusCodes.HTTP_STATUS_OK, searchIndexDeletedResponse())
      nock(config.get('guidanceApi.baseUrl'))
        .post(`${SEARCH_INDEX_URL}/rebuild`)
        .reply(statusCodes.HTTP_STATUS_CREATED, {})

      const deleted = await server.inject({
        method: 'POST',
        url: `${SEARCH_INDEX_URL}/delete`,
        headers: { cookie },
        payload: {}
      })
      const afterDelete = mergeCookies(cookie, deleted.headers['set-cookie'])

      const rebuilt = await server.inject({
        method: 'POST',
        url: `${SEARCH_INDEX_URL}/rebuild`,
        headers: { cookie: afterDelete },
        payload: {}
      })
      const { page } = await getPage(mergeCookies(afterDelete, rebuilt.headers['set-cookie']))

      expect(page.getByText(/The search index is being rebuilt/)).toBeInTheDocument()
      expect(page.queryByText(/Search index deleted/)).not.toBeInTheDocument()
    })
  })
})
