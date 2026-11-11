// @vitest-environment jsdom
import { initSideNavLists } from '../../../../src/client/javascripts/side-nav-lists.js'

describe('the side navigation\'s lists', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
  })

  test('keep whether each is open, once the user opens or closes it', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 204 }))
    document.body.innerHTML = `
      <details id="side-nav-pinned" data-preference="sideNavPinnedCollapsed" open><summary>Pinned guidance</summary></details>
      <details id="side-nav-bookmarks" data-preference="sideNavBookmarksCollapsed"><summary>Case bookmarks</summary></details>`
    initSideNavLists()

    document.getElementById('side-nav-pinned').open = false
    document.getElementById('side-nav-bookmarks').open = true
    // jsdom fires a details element's toggle event after a task.
    await new Promise(resolve => setTimeout(resolve))

    expect(window.fetch.mock.calls.map(([url, { method, body }]) => [url, method, String(body)])).toEqual([
      ['/preferences', 'post', 'sideNavPinnedCollapsed=true'],
      ['/preferences', 'post', 'sideNavBookmarksCollapsed=false']
    ])
  })
})
