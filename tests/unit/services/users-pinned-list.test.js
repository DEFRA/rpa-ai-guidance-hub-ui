import nock from 'nock'

import { config } from '../../../src/config/config.js'
import * as usersService from '../../../src/services/users.js'
import { guideSummaryResponse } from '../../fixtures/guidance-api.js'

const GUIDANCE_API = config.get('guidanceApi.baseUrl')
const HUB_ID = '01a18d45-0000-7000-8000-000000000001'
const GUIDE = '0199b8a2-4c1e-7b3a-9d2f-6a1e3c5b7d90'
const COUNTS = { audience: [], system: [{ label: 'CRM', shortLabel: null, count: 1, retired: false }], scheme: [] }

function signedInRequest () {
  return { auth: { credentials: { sessionId: 's-1', profile: { id: 'oid-1' }, token: 't', userId: HUB_ID } }, app: {} }
}

describe('the user\'s pinned guides, as the guidance API lists them', () => {
  beforeAll(() => {
    nock.disableNetConnect()
  })

  afterEach(() => {
    nock.cleanAll()
  })

  afterAll(() => {
    nock.enableNetConnect()
  })

  test('are asked for with each chosen value of a filter, and the guides for no scheme', async () => {
    const listing = nock(GUIDANCE_API)
      .get(`/users/${HUB_ID}/pins`)
      .query({ system: ['CRM', 'Siti Agri'], audience: 'Caseworker', no_scheme: 'true' })
      .reply(200, { items: [guideSummaryResponse({ id: GUIDE, position: 2 })], counts: COUNTS })

    const listed = await usersService.listPinned(signedInRequest(), { audience: ['Caseworker'], system: ['CRM', 'Siti Agri'], scheme: [], noScheme: true })

    expect(listing.isDone()).toBe(true)
    expect(listed.guides).toEqual([expect.objectContaining({ id: GUIDE, title: 'Claiming the SFI payment', position: 2 })])
    expect(listed.counts).toEqual(COUNTS)
  })

  test('are asked for with nothing about schemes when the guides for no scheme are not chosen', async () => {
    const listing = nock(GUIDANCE_API)
      .get(`/users/${HUB_ID}/pins`)
      .query({ scheme: 'Countryside Stewardship' })
      .reply(200, { items: [], counts: COUNTS })

    await usersService.listPinned(signedInRequest(), { audience: [], system: [], scheme: ['Countryside Stewardship'], noScheme: false })

    expect(listing.isDone()).toBe(true)
  })
})
