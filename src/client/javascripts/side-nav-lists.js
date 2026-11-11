/**
 * @module The side navigation's lists (Pinned guidance, Case bookmarks). Each
 * opens and closes without JavaScript; with it, whether it is closed is sent
 * as the user's preference, so their next page draws it the same way. One
 * that is not kept is not shown.
 */

/**
 * @returns {void}
 */
function initSideNavLists () {
  document.querySelectorAll('details[data-preference]').forEach((list) => {
    list.addEventListener('toggle', () => {
      const body = new URLSearchParams({ [list.dataset.preference]: !list.open })

      window.fetch('/preferences', { method: 'post', body }).catch(() => {})
    })
  })
}

export { initSideNavLists }
