import nock from 'nock'

import { config } from '../../../src/config/config.js'
import {
  keepPreferences,
  preferencesOf
} from '../../../src/services/preferences.js'
import { preferencesResponse } from '../../fixtures/guidance-api.js'

const { mockLoggerWarn } = vi.hoisted(() => ({ mockLoggerWarn: vi.fn() }))

// seam: the warning is the only sign a page fell back to the defaults
vi.mock('../../../src/infra/logging/logger.js', () => ({
  createLogger: () => ({ warn: mockLoggerWarn })
}))

const GUIDANCE_API = config.get('guidanceApi.baseUrl')
const HUB_ID = '01a18d45-0000-7000-8000-000000000001'
const PREFERENCES_PATH = `/preferences/${HUB_ID}`

/**
 * A signed-in request whose session knows the hub's id for the user.
 *
 * @returns {Object}
 */
function signedInRequest () {
  const credentials = { sessionId: 's-1', userId: HUB_ID }

  return { auth: { credentials }, app: {} }
}

beforeAll(() => {
  nock.disableNetConnect()
})

afterAll(() => {
  nock.enableNetConnect()
})

afterEach(() => {
  nock.cleanAll()
  vi.resetAllMocks()
})

describe('preferencesOf', () => {
  test('answers only the preferences the user has set, by name', async () => {
    nock(GUIDANCE_API)
      .get(PREFERENCES_PATH)
      .reply(200, preferencesResponse({
        guideFormat: 'stepper',
        sideNavWidth: 360
      }))

    const preferences = await preferencesOf(signedInRequest())

    expect(preferences).toEqual({ guideFormat: 'stepper', sideNavWidth: 360 })
  })

  test('asks the API once a request, however many parts ask', async () => {
    const read = nock(GUIDANCE_API)
      .get(PREFERENCES_PATH)
      .reply(200, preferencesResponse())
    const secondRead = nock(GUIDANCE_API)
      .get(PREFERENCES_PATH)
      .reply(200, preferencesResponse())

    const request = signedInRequest()

    await Promise.all([preferencesOf(request), preferencesOf(request)])

    expect(read.isDone()).toBe(true)
    expect(secondRead.isDone()).toBe(false)
  })

  test('answers none, and warns, when the API cannot answer', async () => {
    nock(GUIDANCE_API).get(PREFERENCES_PATH).reply(503)

    const preferences = await preferencesOf(signedInRequest())

    expect(preferences).toEqual({})
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: expect.objectContaining({ type: 'preferences_unavailable' })
      }),
      expect.stringContaining('Could not read the user\'s preferences')
    )
  })
})

describe('keepPreferences', () => {
  test('sends only the preferences changed, as a merge patch', async () => {
    let sent

    nock(GUIDANCE_API)
      .matchHeader('Content-Type', 'application/merge-patch+json')
      .patch(PREFERENCES_PATH)
      .reply(200, preferencesResponse({ guideFormat: 'stepper' }))
      .on('request', (_req, _interceptor, body) => { sent = JSON.parse(body) })

    await keepPreferences(signedInRequest(), { guideFormat: 'stepper' })

    expect(sent).toEqual({ guideFormat: 'stepper' })
  })

  test('rejects when the API cannot keep the change', async () => {
    nock(GUIDANCE_API).patch(PREFERENCES_PATH).reply(503)

    await expect(
      keepPreferences(signedInRequest(), { guideFormat: 'stepper' })
    ).rejects.toMatchObject({
      message: expect.stringMatching(/PATCH \/preferences\/\S+ failed: 503/)
    })
  })
})
