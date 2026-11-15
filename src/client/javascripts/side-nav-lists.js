/**
 * @module The side navigation's lists (Pinned guidance, Case bookmarks). Each
 * opens and closes without JavaScript; with it, whether it is closed is sent
 * as the user's preference, so their next page draws it the same way. A
 * choice that is not kept is not worth a message.
 */

/**
 * @returns {void}
 */
function initSideNavLists () {
  document.querySelectorAll('details[data-preference]').forEach((list) => {
    list.addEventListener('toggle', () => {
      const closed = { [list.dataset.preference]: !list.open }
      const body = new URLSearchParams(closed)

      window.fetch('/preferences', { method: 'post', body }).catch(() => {})
    })
  })
}

export { initSideNavLists }
