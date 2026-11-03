import nock from 'nock'

import { config } from '../../../../src/config/config.js'
import * as usersApi from '../../../../src/infra/guidance-api/users.js'
import { pinnedGuidesResponse } from '../../../fixtures/guidance-api.js'

const GUIDANCE_API = config.get('guidanceApi.baseUrl')
const HUB_ID = '01a18d45-0000-7000-8000-000000000001'
const COUNTS = { audience: [], system: [{ label: 'CRM', shortLabel: null, count: 1, retired: false }], scheme: [] }

beforeAll(() => {
  nock.disableNetConnect()
})

afterAll(() => {
  nock.enableNetConnect()
})

afterEach(() => {
  nock.cleanAll()
})

describe('users infra', () => {
  describe('getPins', () => {
    test('asks for the user\'s pins with each chosen value of a filter, and the guides for no scheme', async () => {
      const page = pinnedGuidesResponse({ counts: COUNTS })
      const listing = nock(GUIDANCE_API)
        .get(`/users/${HUB_ID}/pins`)
        .query({ system: ['CRM', 'Siti Agri'], audience: 'Caseworker', no_scheme: 'true' })
        .reply(200, page)

      const res = await usersApi.getPins(HUB_ID, { audience: ['Caseworker'], system: ['CRM', 'Siti Agri'], scheme: [], noScheme: true })

      expect(listing.isDone()).toBe(true)
      expect(res.data).toEqual(page)
    })

    test('asks with nothing about schemes when the guides for no scheme are not chosen', async () => {
      const page = pinnedGuidesResponse({ items: [], counts: COUNTS })
      const listing = nock(GUIDANCE_API)
        .get(`/users/${HUB_ID}/pins`)
        .query({ scheme: 'Countryside Stewardship' })
        .reply(200, page)

      const res = await usersApi.getPins(HUB_ID, { audience: [], system: [], scheme: ['Countryside Stewardship'], noScheme: false })

      expect(listing.isDone()).toBe(true)
      expect(res.data).toEqual(page)
    })
  })

  describe('getRecentlyOpened', () => {
    test('asks for the guides the user opened recently with each chosen value of a filter, and the guides for no scheme', async () => {
      const page = { items: [{ ...guideSummaryResponse({ id: GUIDE }), openedAt: '2026-11-03T17:00:00' }], counts: COUNTS }
      const listing = nock(GUIDANCE_API)
        .get(`/users/${HUB_ID}/recently-opened`)
        .query({ system: ['CRM', 'Siti Agri'], audience: 'Caseworker', no_scheme: 'true' })
        .reply(200, page)

      const res = await usersApi.getRecentlyOpened(HUB_ID, { audience: ['Caseworker'], system: ['CRM', 'Siti Agri'], scheme: [], noScheme: true })

      expect(listing.isDone()).toBe(true)
      expect(res.data).toEqual(page)
    })

    test('asks with nothing about schemes when the guides for no scheme are not chosen', async () => {
      const listing = nock(GUIDANCE_API)
        .get(`/users/${HUB_ID}/recently-opened`)
        .query({ scheme: 'Countryside Stewardship' })
        .reply(200, { items: [], counts: COUNTS })

      const res = await usersApi.getRecentlyOpened(HUB_ID, { audience: [], system: [], scheme: ['Countryside Stewardship'], noScheme: false })

      expect(listing.isDone()).toBe(true)
      expect(res.data).toEqual({ items: [], counts: COUNTS })
    })
  })
})
