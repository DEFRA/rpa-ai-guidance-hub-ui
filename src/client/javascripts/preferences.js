/**
 * @module The preferences a page's scripts send behind the scenes
 * (`POST /preferences`): the widths of the resizable panes, and whether each
 * of the side navigation's lists is closed.
 *
 * Changes go one request at a time, so the latest is kept last. A request
 * starts no sooner than GAP_MS after the one before, so a page that changes a
 * preference over and over cannot flood the API. A change made while a
 * request is on its way waits, replacing any change to the same preference
 * already waiting. A value already kept is not sent again. Whatever is still
 * waiting when the user leaves the page is sent as they go.
 *
 * A change that cannot be kept fails quietly: the page already shows it, and
 * the next page just shows the preference as it was.
 */

// The least time from one request starting to the next, in milliseconds.
const GAP_MS = 1000

const PREFERENCES_PATH = '/preferences'

/**
 * @private
 * @param {number} ms
 * @returns {Promise<void>}
 */
function _wait (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

class PreferenceSaver {
  #waiting = {}
  #kept = {}
  #sending = false

  constructor () {
    window.addEventListener('pagehide', () => this.#sendAsTheUserLeaves())
  }

  /**
   * @param {Object<string, string|number|boolean>} changes - By name
   * @returns {void}
   */
  save (changes) {
    Object.assign(this.#waiting, changes)

    if (this.#sending) {
      return
    }

    this.#sendWaiting()
  }

  async #sendWaiting () {
    const changes = this.#takeWaiting()

    if (!changes) {
      this.#sending = false
      return
    }

    this.#sending = true

    await Promise.all([this.#send(changes), _wait(GAP_MS)])

    this.#sendWaiting()
  }

  #sendAsTheUserLeaves () {
    const changes = this.#takeWaiting()

    if (!changes) {
      return
    }

    this.#send(changes, { keepalive: true })
  }

  // The changes waiting that are not already kept, or null for none.
  #takeWaiting () {
    const unkept = Object.entries(this.#waiting)
      .filter(([name, value]) => this.#kept[name] !== value)

    this.#waiting = {}

    return unkept.length ? Object.fromEntries(unkept) : null
  }

  async #send (changes, init) {
    const body = new URLSearchParams(changes)

    try {
      const res = await window.fetch(PREFERENCES_PATH, { ...init, method: 'post', body })

      if (res.ok) {
        Object.assign(this.#kept, changes)
      }
    } catch {
      // Nothing to undo: see the module's note.
    }
  }
}

let pageSaver

/**
 * Sends changes to the user's preferences, through the one saver the page
 * has, so changes from every script on it are sent in turn.
 *
 * @param {Object<string, string|number|boolean>} changes - By name
 * @returns {void}
 */
function savePreferences (changes) {
  pageSaver ??= new PreferenceSaver()

  pageSaver.save(changes)
}

export { GAP_MS, PreferenceSaver, savePreferences }
