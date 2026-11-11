import * as preferencesApi from '../../../src/infra/guidance-api/preferences.js'
import { keepPreferences, preferencesOf } from '../../../src/services/preferences.js'
import { preferencesResponse } from '../../fixtures/guidance-api.js'

const { mockLoggerWarn } = vi.hoisted(() => ({ mockLoggerWarn: vi.fn() }))

vi.mock('../../../src/infra/guidance-api/preferences.js')
vi.mock('../../../src/infra/logging/logger.js', () => ({
  createLogger: () => ({ warn: mockLoggerWarn })
}))

const HUB_ID = '01a18d45-0000-7000-8000-000000000001'

/** A signed-in request. */
function requestIn () {
  return { auth: { credentials: { sessionId: 's-1', userId: HUB_ID } }, app: {} }
}

function answerPreferences (kept) {
  preferencesApi.getPreferences.mockResolvedValue({ ok: true, status: 200, data: preferencesResponse(kept) })
}

describe('preferences service', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  describe('preferencesOf', () => {
    test('answers the preferences the user has set, by name, from the API', async () => {
      answerPreferences({ guideFormat: 'stepper', sideNavWidth: 360 })

      expect(await preferencesOf(requestIn())).toEqual({ guideFormat: 'stepper', sideNavWidth: 360 })
      expect(preferencesApi.getPreferences).toHaveBeenCalledWith(HUB_ID)
    })

    test('asks the API once a request, however many parts of the page need them', async () => {
      answerPreferences({})
      const request = requestIn()

      await Promise.all([preferencesOf(request), preferencesOf(request)])

      expect(preferencesApi.getPreferences).toHaveBeenCalledTimes(1)
    })

    test('answers none when they cannot be read, so the page shows the defaults, which is logged', async () => {
      preferencesApi.getPreferences.mockRejectedValue(new Error('API unavailable'))

      expect(await preferencesOf(requestIn())).toEqual({})
      expect(mockLoggerWarn).toHaveBeenCalledWith(
        expect.objectContaining({ event: expect.objectContaining({ type: 'preferences_unavailable' }) }),
        'Could not read the user\'s preferences: API unavailable'
      )
    })
  })

  describe('keepPreferences', () => {
    test('sends the change to the API as a merge patch of the preferences named', async () => {
      preferencesApi.patchPreferences.mockResolvedValue({ ok: true, status: 200, data: preferencesResponse() })

      await keepPreferences(requestIn(), { guideFormat: 'stepper' })

      expect(preferencesApi.patchPreferences).toHaveBeenCalledWith(HUB_ID, { guideFormat: 'stepper' })
    })

    test('fails when the API cannot keep the change', async () => {
      preferencesApi.patchPreferences.mockRejectedValue(new Error('API unavailable'))

      await expect(keepPreferences(requestIn(), { guideFormat: 'stepper' })).rejects.toThrow('API unavailable')
    })
  })
})
