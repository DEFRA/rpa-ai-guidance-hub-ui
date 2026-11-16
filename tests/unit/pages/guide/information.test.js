import {
  isInformationShown,
  setInformationShown
} from '../../../../src/pages/guide/information.js'
import {
  keepPreferences,
  preferencesOf
} from '../../../../src/services/preferences.js'

// seam: the preferences service is tested on its own, against the API
vi.mock('../../../../src/services/preferences.js')

const request = {}

afterEach(() => {
  vi.resetAllMocks()
})

describe('a guide\'s information', () => {
  test('is hidden until the user shows it', async () => {
    preferencesOf.mockResolvedValue({})

    expect(await isInformationShown(request)).toBe(false)
  })

  test.each([[true], [false]])('is shown as %s once chosen, for every guide',
    async (shown) => {
      preferencesOf.mockResolvedValue({ guideInformationShown: shown })

      expect(await isInformationShown(request)).toBe(shown)
    })

  test('is hidden for anything kept other than true', async () => {
    preferencesOf.mockResolvedValue({ guideInformationShown: 'true' })

    expect(await isInformationShown(request)).toBe(false)
  })

  test('is kept as the user\'s preference', async () => {
    await setInformationShown(request, true)

    expect(keepPreferences)
      .toHaveBeenCalledWith(request, { guideInformationShown: true })
  })
})
