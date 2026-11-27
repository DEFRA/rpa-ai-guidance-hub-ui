import nock from 'nock'

import { createServer } from '../../../../../src/server/server.js'
import { findTheUserInTheApi } from '../../../helpers/admin-api.js'
import { loginAsDevUser } from '../../../helpers/login.js'
import { pageOf } from '../../../helpers/page.js'

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
  })
})
