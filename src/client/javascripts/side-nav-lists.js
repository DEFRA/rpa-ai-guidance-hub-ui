/**
 * @module The side navigation's lists (Pinned guidance, Case bookmarks). Each
 * opens and closes without JavaScript; with it, whether it is closed is sent
 * as the user's preference, so their next page draws it the same way.
 */

import { savePreferences } from './preferences.js'

/**
 * @returns {void}
 */
function initSideNavLists () {
  document.querySelectorAll('details[data-preference]').forEach((list) => {
    list.addEventListener('toggle', () => {
      savePreferences({ [list.dataset.preference]: !list.open })
    })
  })
}

export { initSideNavLists }
