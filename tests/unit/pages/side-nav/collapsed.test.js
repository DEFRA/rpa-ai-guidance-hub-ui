import { isNavCollapsed, setNavCollapsed } from '../../../../src/pages/side-nav/collapsed.js'
import { keepPreferences, preferencesOf } from '../../../../src/services/preferences.js'

vi.mock('../../../../src/services/preferences.js')

const request = {}

describe('whether the side navigation is folded away', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  test('is open until the user folds it', async () => {
    preferencesOf.mockResolvedValue({})

    expect(await isNavCollapsed(request)).toBe(false)
  })

  test.each([[true], [false]])('is folded as %s once the user chooses, on every page', async (collapsed) => {
    preferencesOf.mockResolvedValue({ sideNavCollapsed: collapsed })

    expect(await isNavCollapsed(request)).toBe(collapsed)
  })

  test('is kept as the user\'s preference', async () => {
    await setNavCollapsed(request, true)

    expect(keepPreferences).toHaveBeenCalledWith(request, { sideNavCollapsed: true })
  })

  test('is open for anything kept other than true', async () => {
    preferencesOf.mockResolvedValue({ sideNavCollapsed: 'true' })

    expect(await isNavCollapsed(request)).toBe(false)
  })
})
