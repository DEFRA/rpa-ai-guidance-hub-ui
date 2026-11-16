// @vitest-environment jsdom
import { savePreferences } from '../../../../src/client/javascripts/preferences.js'
import {
  initSideNavLists
} from '../../../../src/client/javascripts/side-nav-lists.js'

// seam: how a preference reaches the API is preferences.js's to test
vi.mock('../../../../src/client/javascripts/preferences.js', () => ({
  savePreferences: vi.fn()
}))

beforeEach(() => {
  document.body.innerHTML = `
    <details id="side-nav-pinned"
      data-preference="sideNavPinnedCollapsed" open>
      <summary>Pinned guidance</summary>
    </details>
    <details id="side-nav-bookmarks"
      data-preference="sideNavBookmarksCollapsed">
      <summary>Case bookmarks</summary>
    </details>`
})

afterEach(() => {
  document.body.innerHTML = ''
})

test('sends whether each list is closed, as the user opens or closes it',
  async () => {
    initSideNavLists()

    document.getElementById('side-nav-pinned').open = false
    document.getElementById('side-nav-bookmarks').open = true

    // jsdom fires a details element's toggle event after a task.
    await new Promise(resolve => setTimeout(resolve))

    expect(savePreferences.mock.calls).toEqual([
      [{ sideNavPinnedCollapsed: true }],
      [{ sideNavBookmarksCollapsed: false }]
    ])
  })
