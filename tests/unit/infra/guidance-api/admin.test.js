import nock from 'nock'

import { config } from '../../../../src/config/config.js'
import {
  deleteSearchIndex,
  rebuildSearchIndex
} from '../../../../src/infra/guidance-api/admin.js'
import { searchIndexDeletedResponse } from '../../../fixtures/guidance-api.js'

const GUIDANCE_API = config.get('guidanceApi.baseUrl')
const HUB_ID = '01a18d45-0000-7000-8000-000000000001'

beforeAll(() => {
  nock.disableNetConnect()
})

afterAll(() => {
  nock.enableNetConnect()
})

afterEach(() => {
  nock.cleanAll()
})

describe('deleteSearchIndex', () => {
  test('sends who asked as the x-requested-by header', async () => {
    nock(GUIDANCE_API)
      .matchHeader('x-requested-by', HUB_ID)
      .delete('/admin/search-index')
      .reply(200, searchIndexDeletedResponse())

    const res = await deleteSearchIndex(HUB_ID)

    // Without the header nothing matches, and the request fails
    expect(res.status).toBe(200)
  })

  test('answers what the delete removed', async () => {
    const removed = searchIndexDeletedResponse({ deletedObjects: 3 })
    nock(GUIDANCE_API).delete('/admin/search-index').reply(200, removed)

    const res = await deleteSearchIndex(HUB_ID)

    expect(res.data).toEqual(removed)
  })

  test('answers the status, without throwing, when search failed', async () => {
    nock(GUIDANCE_API).delete('/admin/search-index').reply(502, {})

    const res = await deleteSearchIndex(HUB_ID)

    expect(res.status).toBe(502)
  })

  test('throws on any other status that is not ok', async () => {
    nock(GUIDANCE_API).delete('/admin/search-index').reply(500, {})

    await expect(deleteSearchIndex(HUB_ID)).rejects.toMatchObject({
      name: 'GuidanceApiError',
      statusCode: 500
    })
  })
})

describe('rebuildSearchIndex', () => {
  test('sends who asked as requestedBy in the body', async () => {
    nock(GUIDANCE_API)
      .post('/admin/search-index/rebuild', { requestedBy: HUB_ID })
      .reply(201, {})

    const res = await rebuildSearchIndex(HUB_ID)

    // With any other body nothing matches, and the request fails
    expect(res.status).toBe(201)
  })

  test('throws when the API does not accept it', async () => {
    nock(GUIDANCE_API).post('/admin/search-index/rebuild').reply(500, {})

    await expect(rebuildSearchIndex(HUB_ID)).rejects.toMatchObject({
      name: 'GuidanceApiError',
      statusCode: 500
    })
  })
})
