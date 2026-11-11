import { getGuideFormat, GUIDE_FORMATS, setGuideFormat } from '../../../../src/pages/guide/format.js'
import { keepPreferences, preferencesOf } from '../../../../src/services/preferences.js'

vi.mock('../../../../src/services/preferences.js')

const request = {}

describe('guide format', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  test('offers the whole guide, Traditional, and a section at a time, Stepper', () => {
    expect(GUIDE_FORMATS).toEqual([
      { value: 'traditional', text: 'Traditional' },
      { value: 'stepper', text: 'Stepper' }
    ])
  })

  test('is traditional until one is chosen', async () => {
    preferencesOf.mockResolvedValue({})

    expect(await getGuideFormat(request)).toBe('traditional')
  })

  test.each([['stepper'], ['traditional']])('is %s once the user chooses it', async (format) => {
    preferencesOf.mockResolvedValue({ guideFormat: format })

    expect(await getGuideFormat(request)).toBe(format)
  })

  test('is kept as the user\'s preference', async () => {
    await setGuideFormat(request, 'stepper')

    expect(keepPreferences).toHaveBeenCalledWith(request, { guideFormat: 'stepper' })
  })

  test('ignores a kept value that is not an offered format', async () => {
    preferencesOf.mockResolvedValue({ guideFormat: 'scroll' })

    expect(await getGuideFormat(request)).toBe('traditional')
  })
})
