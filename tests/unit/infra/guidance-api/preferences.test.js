import nock from 'nock'

import { config } from '../../../../src/config/config.js'
import {
  getPreferences,
  patchPreferences
} from '../../../../src/infra/guidance-api/preferences.js'
import { preferencesResponse } from '../../../fixtures/guidance-api.js'

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

describe('getPreferences', () => {
  test('answers every preference the API keeps for the user', async () => {
    const kept = preferencesResponse({ readingWidth: 'wide' })
    nock(GUIDANCE_API).get(`/preferences/${HUB_ID}`).reply(200, kept)

    const res = await getPreferences(HUB_ID)

    expect(res.data).toEqual(kept)
  })

  test('escapes the user\'s id in the path', async () => {
    const read = nock(GUIDANCE_API)
      .get('/preferences/a%2Fb')
      .reply(200, preferencesResponse())

    await getPreferences('a/b')

    expect(read.isDone()).toBe(true)
  })
})

describe('patchPreferences', () => {
  test('sends the changes as a JSON merge patch', async () => {
    const patch = nock(GUIDANCE_API)
      .matchHeader('Content-Type', 'application/merge-patch+json')
      .patch(`/preferences/${HUB_ID}`, { readingWidth: null })
      .reply(200, preferencesResponse())

    await patchPreferences(HUB_ID, { readingWidth: null })

    expect(patch.isDone()).toBe(true)
  })
})
