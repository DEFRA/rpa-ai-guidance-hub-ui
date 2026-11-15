import {
  isNavCollapsed,
  setNavCollapsed
} from '../../../../src/pages/side-nav/collapsed.js'
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

describe('whether the side navigation is folded away', () => {
  test('is open until the user folds it', async () => {
    preferencesOf.mockResolvedValue({})

    expect(await isNavCollapsed(request)).toBe(false)
  })

  test.each([[true], [false]])('is folded as %s', async (folded) => {
    preferencesOf.mockResolvedValue({ sideNavCollapsed: folded })

    expect(await isNavCollapsed(request)).toBe(folded)
  })

  test('is open for anything kept other than true', async () => {
    preferencesOf.mockResolvedValue({ sideNavCollapsed: 'true' })

    expect(await isNavCollapsed(request)).toBe(false)
  })

  test('is kept as the user\'s preference', async () => {
    await setNavCollapsed(request, true)

    expect(keepPreferences)
      .toHaveBeenCalledWith(request, { sideNavCollapsed: true })
  })
})
