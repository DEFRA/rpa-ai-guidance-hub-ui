import {
  getReadingWidth,
  isReadingWidth,
  setReadingWidth
} from '../../../../src/pages/guide/reading-width.js'
import { keepPreferences, preferencesOf } from '../../../../src/services/preferences.js'

vi.mock('../../../../src/services/preferences.js')

const request = {}

describe('reading width', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  test('is standard until one is chosen', async () => {
    preferencesOf.mockResolvedValue({})

    expect(await getReadingWidth(request)).toBe('standard')
  })

  test.each([['standard'], ['wide'], ['full']])('is %s once the user chooses it', async (width) => {
    preferencesOf.mockResolvedValue({ readingWidth: width })

    expect(await getReadingWidth(request)).toBe(width)
  })

  test('is kept as the user\'s preference', async () => {
    await setReadingWidth(request, 'wide')

    expect(keepPreferences).toHaveBeenCalledWith(request, { readingWidth: 'wide' })
  })

  test('ignores a kept value that is not an offered width', async () => {
    preferencesOf.mockResolvedValue({ readingWidth: 'huge' })

    expect(await getReadingWidth(request)).toBe('standard')
  })

  test.each([['wide', true], ['huge', false], [undefined, false]])('isReadingWidth(%j) is %s', (width, expected) => {
    expect(isReadingWidth(width)).toBe(expected)
  })
})
