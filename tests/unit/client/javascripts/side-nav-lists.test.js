// @vitest-environment jsdom
import {
  initSideNavLists
} from '../../../../src/client/javascripts/side-nav-lists.js'

beforeEach(() => {
  const kept = () => Promise.resolve(new window.Response(null, { status: 204 }))
  vi.stubGlobal('fetch', vi.fn(kept))
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
  vi.unstubAllGlobals()
})

test('sends whether each list is closed, as the user opens or closes it',
  async () => {
    initSideNavLists()

    document.getElementById('side-nav-pinned').open = false
    document.getElementById('side-nav-bookmarks').open = true
    // jsdom fires a details element's toggle event after a task.
    await new Promise(resolve => setTimeout(resolve))

    const sent = fetch.mock.calls
      .map(([url, init]) => [url, init.method, `${init.body}`])
    expect(sent).toEqual([
      ['/preferences', 'post', 'sideNavPinnedCollapsed=true'],
      ['/preferences', 'post', 'sideNavBookmarksCollapsed=false']
    ])
  })
