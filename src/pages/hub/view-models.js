import { relativeHref } from '../common/relative-href.js'
import { versionTag } from '../common/version-tag.js'
import { searchHref, searchPagination } from './search.js'

/**
 * What the hub's lists say when they are empty, named once, so that one test
 * holds their words and the rest name them. `nonePinned` is HTML, so the
 * control it tells the user to select can be bold.
 */
const HUB_MESSAGES = Object.freeze({
  noneMatch: 'No guides match your search or filters. Try removing some filters or using different search terms.',
  noneOpened: "You haven't opened any guidance yet. Any guidance you open will appear here.",
  nonePinned: 'You have not pinned any guidance yet. Select <strong>Pin guide</strong> on a guide, or the star next to a section heading, to add it here.',
  noneBookmarked: "You haven't bookmarked any guidance yet. Bookmark a section of a guide to add it here.",
  noGuides: 'There are no guides yet.'
})

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
 * @param {string|null} [list.narrowedTo=null] - The case it is narrowed to,
 *   which its heading names, so a screen reader user who jumps to the heading
 *   is told
 */
function _buildGuideList ({ items, noun = 'guide', onlyPins = false, emptyHtml, narrowedTo = null }) {
  const count = items.length
  const counted = `${count} ${noun}${count === 1 ? '' : 's'}`

  return {
    heading: narrowedTo ? `${counted} for ${narrowedTo}` : counted,
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
 * @private
 * @param {number} count
 * @param {string} one - The noun for one
 * @param {string} many - The noun for any other count
 * @returns {string}
 */
function _counted (count, one, many) {
  return `${count} ${count === 1 ? one : many}`
}

/**
 * @private
 * @param {import('../../services/search.js').SearchResult} result
 * @param {boolean} withGuide - Whether to name its guide, as a list of
 *   sections from many guides must
 * @returns {Object} As `search-results.njk` shows it: its link made safe, and
 *   how often it matches, after its guide if named, as one line
 */
function _searchRow (result, withGuide) {
  const matches = _counted(result.matches, 'match', 'matches')

  return {
    title: result.title,
    href: relativeHref(result.href),
    hint: withGuide ? `${result.documentTitle} · ${matches}` : matches,
    snippet: result.snippet
  }
}

/**
 * @private
 * One guide that has the words, as `search-results.njk` shows it: a link to
 * it, how many of its sections have them, its best few, and, when it has more
 * than those, a link to every one of them.
 *
 * @param {import('../../services/search.js').GuideResult} guide
 * @param {string} words
 * @returns {Object}
 */
function _guideGroup (guide, words) {
  const more = guide.sectionTotal > guide.sections.length

  return {
    title: guide.title,
    href: relativeHref(guide.href),
    hint: `${_counted(guide.sectionTotal, 'section', 'sections')} with these words`,
    sections: guide.sections.map((section) => _searchRow(section, false)),
    more: more
      ? { href: searchHref({ words, guide: guide.id }), text: `See all ${guide.sectionTotal} sections in this guide` }
      : null
  }
}

/**
 * @private
 * @param {Object} search
 * @param {string} search.words
 * @param {number} search.page
 * @param {string|null} search.guide - Searched inside, if one
 * @param {{total: number, tooManyMatches: boolean, results: Array<object>}} search.found
 * @returns {string|null} Why there are no results to list, if there are none
 */
function _searchEmptyMessage (search) {
  if (search.found.tooManyMatches) {
    return 'Too many matches. Use more specific words.'
  }

  if (search.found.total === 0) {
    return search.guide
      ? `This guide has no sections with the words “${search.words}”.`
      : `No guides have the words “${search.words}”. Check the spelling or try fewer words.`
  }

  if (search.found.results.length === 0) {
    return `There is no page ${search.page} of results.`
  }

  return null
}

/**
 * The guides that have the words, each with its best sections, as
 * `search-results.njk` shows them.
 *
 * @private
 * @param {Object} search
 * @param {string} search.words
 * @param {number} search.page
 * @param {import('../../services/search.js').GuideResults} search.found
 * @returns {Object}
 */
function _buildGuidesSearch (search) {
  const found = search.found

  return {
    words: search.words,
    heading: _counted(found.total, 'guide', 'guides'),
    summary: found.total > 0 ? `${_counted(found.sectionTotal, 'section', 'sections')} with these words` : null,
    backLink: null,
    emptyMessage: _searchEmptyMessage(search),
    guides: found.tooManyMatches ? [] : found.results.map((guide) => _guideGroup(guide, search.words)),
    results: [],
    pagination: searchPagination({ words: search.words, page: search.page, total: found.total, tooManyMatches: found.tooManyMatches })
  }
}

/**
 * One guide's sections that have the words, as `search-results.njk` shows
 * them, with a way back to every guide that has them.
 *
 * @private
 * @param {Object} search
 * @param {string} search.words
 * @param {number} search.page
 * @param {string} search.guide
 * @param {import('../../services/search.js').SearchResults} search.found
 * @returns {Object}
 */
function _buildGuideSearch (search) {
  const found = search.found
  const guideTitle = found.results[0]?.documentTitle

  return {
    words: search.words,
    heading: _counted(found.total, 'section', 'sections'),
    summary: guideTitle ? `In ${guideTitle}` : null,
    backLink: { href: searchHref({ words: search.words }), text: 'All guides with these words' },
    emptyMessage: _searchEmptyMessage(search),
    guides: [],
    results: found.tooManyMatches ? [] : found.results.map((result) => _searchRow(result, false)),
    pagination: searchPagination({ words: search.words, guide: search.guide, page: search.page, total: found.total, tooManyMatches: found.tooManyMatches })
  }
}

/**
 * The results of searching the guides, or one guide, as
 * `search-results.njk` shows them.
 *
 * @private
 * @param {Object} search
 * @param {string|null} [search.guide]
 * @returns {Object}
 */
function _buildSearch (search) {
  return search.guide ? _buildGuideSearch(search) : _buildGuidesSearch(search)
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
   * @param {{words: string, page: number, guide: string|null, found: import('../../services/search.js').GuideResults|import('../../services/search.js').SearchResults}|null} [data.search=null]
   *   - What searching for the words found, shown instead of the list: the
   *   guides that have them, or with `guide`, that guide's sections
   * @param {boolean} [data.searchUnavailable=false] - Searching failed, so the
   *   list is shown with a warning instead
   * @param {{key: string, text: string}|null} [data.narrowedTo=null] - The case
   *   the bookmarked guides are narrowed to, which their heading names
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
      words = '',
      search = null,
      searchUnavailable = false,
      narrowedTo = null
    } = data

    // Chosen filters that leave nothing say so, rather than that there are no
    // guides at all, unless they had nothing to narrow.
    const nothingMatches = filters?.selected?.length > 0 && !nothingToFilter
      ? HUB_MESSAGES.noneMatch
      : null

    this.recentlyOpened = _buildGuideList({
      items: recentlyOpened,
      noun: 'recently opened guide',
      emptyHtml: nothingMatches ?? HUB_MESSAGES.noneOpened
    })

    this.pinned = _buildGuideList({
      items: pinned,
      noun: 'pin',
      onlyPins: true,
      emptyHtml: nothingMatches ?? HUB_MESSAGES.nonePinned
    })

    this.bookmarkedGuides = _buildGuideList({
      items: bookmarkedGuides,
      noun: 'bookmarked guide',
      narrowedTo: narrowedTo?.text,
      emptyHtml: nothingMatches ?? HUB_MESSAGES.noneBookmarked
    })

    this.allGuides = _buildGuideList({
      items: allGuides,
      emptyHtml: nothingMatches ?? HUB_MESSAGES.noGuides
    })

    this.shown = this[shown]
    this.filters = filters
    this.words = words
    this.search = search && _buildSearch(search)
    this.searchUnavailable = searchUnavailable
  }
}

export {
  HUB_MESSAGES,
  HubViewModel
}
