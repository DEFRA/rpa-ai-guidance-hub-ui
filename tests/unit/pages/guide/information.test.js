import { isInformationShown, setInformationShown } from '../../../../src/pages/guide/information.js'
import { keepPreferences, preferencesOf } from '../../../../src/services/preferences.js'

vi.mock('../../../../src/services/preferences.js')

const request = {}

describe('a guide\'s information', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  test('is hidden until the user shows it', async () => {
    preferencesOf.mockResolvedValue({})

    expect(await isInformationShown(request)).toBe(false)
  })

  test.each([[true], [false]])('is shown as %s once the user chooses, for every guide', async (shown) => {
    preferencesOf.mockResolvedValue({ guideInformationShown: shown })

    expect(await isInformationShown(request)).toBe(shown)
  })

  test('is kept as the user\'s preference', async () => {
    await setInformationShown(request, true)

    expect(keepPreferences).toHaveBeenCalledWith(request, { guideInformationShown: true })
  })

  test('is hidden for anything kept other than true', async () => {
    preferencesOf.mockResolvedValue({ guideInformationShown: 'true' })

    expect(await isInformationShown(request)).toBe(false)
  })
})
