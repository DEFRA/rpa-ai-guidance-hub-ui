import nock from 'nock'

import { config } from '../../../src/config/config.js'
import { matchesInGuide } from '../../../src/services/guide-search.js'
import { guideSearchResponse } from '../../fixtures/guidance-api.js'

const { mockLoggerWarn } = vi.hoisted(() => ({ mockLoggerWarn: vi.fn() }))

// seam: the warning is the only sign a guide was shown without its search
vi.mock('../../../src/infra/logging/logger.js', () => ({
  createLogger: () => ({ warn: mockLoggerWarn })
}))

const GUIDANCE_API = config.get('guidanceApi.baseUrl')
const GUIDE_ID = '0199b8a2-4c1e-7b3a-9d2f-6a1e3c5b7d90'
const SEARCH_PATH = `/guides/${GUIDE_ID}/search`

describe('matchesInGuide', () => {
  beforeEach(() => {
    mockLoggerWarn.mockClear()
  })

  afterEach(() => {
    nock.cleanAll()
  })

  test('answers where the words are, as the API does', async () => {
    nock(GUIDANCE_API).get(SEARCH_PATH).query({ q: 'pay' }).reply(200, guideSearchResponse())

    expect(await matchesInGuide(GUIDE_ID, 'pay')).toEqual(guideSearchResponse())
  })

  test('answers none, and warns with the status, when the API does not know the search', async () => {
    nock(GUIDANCE_API).get(SEARCH_PATH).query({ q: 'pay' }).reply(404, {})

    const found = await matchesInGuide(GUIDE_ID, 'pay')

    expect(found).toBeNull()
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({ event: expect.objectContaining({ type: 'guide_search_unavailable' }) }),
      expect.stringContaining('404')
    )
  })

  test('answers none, and warns, when the API cannot answer', async () => {
    nock(GUIDANCE_API).get(SEARCH_PATH).query({ q: 'pay' }).reply(500, {})

    expect(await matchesInGuide(GUIDE_ID, 'pay')).toBeNull()
    expect(mockLoggerWarn).toHaveBeenCalled()
  })
})
