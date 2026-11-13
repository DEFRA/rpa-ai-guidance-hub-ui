import { relativeHref } from '../common/relative-href.js'
import { versionTag } from '../common/version-tag.js'

/**
 * One guide as the hub's rows show it: its version's tag, and its link made
 * safe.
 *
 * @private
 * @param {{id: string, pin: {pinned: boolean, position: number|null}|null, title: string, href: string, versionNumber: string|null, purpose: string|null, lastUpdated: string, published: string}} item
 *   - `pin` is null when the user's pins are not known, and the row offers none
 * @returns {{id: string, pin: {pinned: boolean, position: number|null}|null, title: string, href: string, versionTag: {text: string, colour: string}|null, purpose: string|null, lastUpdated: string, published: string}}
 */
function _guideRow ({ versionNumber, ...item }) {
  return { ...item, href: relativeHref(item.href), versionTag: versionTag(versionNumber) }
}

/**
 * A list of guides shown as rows (`guide-list.njk`), not a table, headed by
 * how many guides it has and saying which of them it shows: all of them, on
 * one page.
 *
 * @private
 * @param {Object} list
 * @param {Array<object>} list.items
 * @param {string} [list.noun='guide'] - What the heading counts
 * @param {boolean} [list.onlyPins=false] - Whether every row is one of the
 *   user's pins, so unpinning one takes it out of the list
 * @param {string} list.emptyHtml - What it says when it has none: HTML, so a
 *   control it tells the user to select can be bold; always the hub's own
 *   words, never anything a user typed
 */
function _buildGuideList ({ items, noun = 'guide', onlyPins = false, emptyHtml }) {
  const count = items.length

  return {
    heading: `${count} ${noun}${count === 1 ? '' : 's'}`,
    showing: count > 0 ? `Showing 1 to ${count}` : null,
    emptyHtml,
    onlyPins,
    isGuideList: true,
    isEmpty: items.length === 0,
    count: items.length,
    guides: items.map(_guideRow)
  }
}

/**
 * HubViewModel - The lists of guides the hub shows: every guide, and the
 * user's own lists. Each is built from data rather than pre-rendered HTML, so
 * Nunjucks' auto-escaping is what makes the output safe.
 */
class HubViewModel {
  /**
   * @param {Object} [data={}]
   * @param {Array<object>} [data.recentlyOpened=[]] - Items are as for
   *   `allGuides`
   * @param {Array<object>} [data.pinned=[]] - Items are as for `allGuides`
   * @param {Array<object>} [data.bookmarkedGuides=[]] - Items are as for
   *   `allGuides`
   * @param {Array<object>} [data.allGuides=[]] - Items are
   *   `{id, pin, title, href, versionNumber, purpose, lastUpdated, published}`
   * @param {string} [data.shown='allGuides'] - The list that the page
   *   shows
   * @param {Object|null} [data.filters=null] - The filter panel beside the
   *   list (`filters.js`), if it has one
   * @param {boolean} [data.nothingToFilter=false] - The list has no guides for
   *   the chosen filters to narrow, so they don't explain why it is empty
   * @param {string} [data.words=''] - Searched for, shown in the search box
   */
  constructor (data = {}) {
    const {
      recentlyOpened = [],
      pinned = [],
      bookmarkedGuides = [],
      allGuides = [],
      shown = 'allGuides',
      filters = null,
      nothingToFilter = false,
      words = ''
    } = data

    // Chosen filters that leave nothing say so, rather than that there are no
    // guides at all, unless they had nothing to narrow.
    const nothingMatches = filters?.selected?.length > 0 && !nothingToFilter
      ? 'No guides match your search or filters. Try removing some filters or using different search terms.'
      : null

    this.recentlyOpened = _buildGuideList({
      items: recentlyOpened,
      noun: 'recently opened guide',
      emptyHtml: nothingMatches ?? "You haven't opened any guidance yet. Any guidance you open will appear here."
    })

    this.pinned = _buildGuideList({
      items: pinned,
      noun: 'pin',
      onlyPins: true,
      emptyHtml: nothingMatches ?? 'You have not pinned any guidance yet. Select <strong>Pin guide</strong> on a guide, or the star next to a section heading, to add it here.'
    })

    this.bookmarkedGuides = _buildGuideList({
      items: bookmarkedGuides,
      noun: 'bookmarked guide',
      emptyHtml: nothingMatches ?? "You haven't bookmarked any guidance yet. Bookmark a section of a guide to add it here."
    })

    this.allGuides = _buildGuideList({
      items: allGuides,
      emptyHtml: nothingMatches ?? 'There are no guides yet.'
    })

    this.shown = this[shown]
    this.filters = filters
    this.words = words
  }
}

export {
  HubViewModel
}
