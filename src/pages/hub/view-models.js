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
 * The level of each guide's heading in the results: under the list's own
 * heading when a title block gives it one, else straight under the page's.
 */
const GUIDE_HEADING_LEVEL = 3
const GUIDE_HEADING_LEVEL_UNDER_LIST = 4

/** How many guides whose title the words cover show until all are asked for. */
const TITLES_SHOWN = 5

/**
 * @private
 * One guide that has the words, as `search-results.njk` shows it: a link to
 * it, its title with the words marked when they cover it, how many of its
 * sections have them, its best few, and, when it has more than those, a link
 * to every one of them.
 *
 * @param {import('../../services/search.js').GuideResult} guide
 * @param {string} words
 * @returns {Object}
 */
function _guideGroup (guide, words) {
  const more = guide.sectionTotal > guide.sections.length

  return {
    title: guide.title,
    titleSnippet: guide.titleSnippet,
    href: relativeHref(guide.href),
    hint: _counted(guide.sectionTotal, 'match', 'matches'),
    sections: guide.sections.map((section) => _searchRow(section, false)),
    more: more
      ? {
          href: searchHref({ words, guide: guide.id }),
          text: `See all ${guide.sectionTotal} matches in this guide`
        }
      : null
  }
}

/**
 * @private
 * The one guide whose title the words cover, as `title-panel.njk` promotes
 * it: its title with the words marked, what it is for, and links to its
 * sections that have the words.
 *
 * @param {import('../../services/search.js').GuideResult} guide
 * @param {string|null} purpose
 * @returns {Object}
 */
function _strongTitle (guide, purpose) {
  return {
    kind: 'strong',
    title: guide.title,
    titleSnippet: guide.titleSnippet,
    href: relativeHref(guide.href),
    purpose,
    alsoFound: guide.sections.map((section) => ({ title: section.title, href: relativeHref(section.href) }))
  }
}

/**
 * @private
 * The guides whose title the words cover, as `title-list.njk` lists them: the
 * first few, with a link to the page again showing every one, or every one
 * when that was asked for.
 *
 * @param {Array<import('../../services/search.js').GuideResult>} guides
 * @param {string} words
 * @param {boolean} allTitles - Every one was asked for
 * @returns {Object}
 */
function _severalTitles (guides, words, allTitles) {
  const rows = guides.map((guide) => ({
    title: guide.title,
    titleSnippet: guide.titleSnippet,
    href: relativeHref(guide.href),
    matchesText: guide.sectionTotal > 0
      ? _counted(guide.sectionTotal, 'match', 'matches')
      : null
  }))

  const showAll = _cutShort(rows.length, allTitles)

  return {
    kind: 'several',
    label: `${guides.length} guides have ‘${words}’ in their title`,
    rows: showAll ? rows.slice(0, TITLES_SHOWN) : rows,
    showAll: showAll
      ? { href: `${searchHref({ words, allTitles: true })}#title-match-heading`, text: `Show all ${guides.length} guides` }
      : null
  }
}

/**
 * @private
 * Whether the guides whose title the words cover are too many to list until
 * every one is asked for.
 *
 * @param {number} count
 * @param {boolean} allTitles - Every one was asked for
 * @returns {boolean}
 */
function _cutShort (count, allTitles) {
  if (allTitles) {
    return false
  }

  return count > TITLES_SHOWN
}

/**
 * @private
 * What `search-results.njk` shows above the guides that have the words: the
 * one guide whose title they cover, or the several, on the first page only.
 * Nothing when they cover none, so the page is as it is without them.
 *
 * @param {Object} search
 * @param {string} search.words
 * @param {number} search.page
 * @param {string|null} [search.promotedPurpose]
 * @param {boolean} [search.allTitles] - Every covered title was asked for
 * @param {import('../../services/search.js').GuideResults} search.found
 * @returns {Object|null}
 */
function _titleBlock (search) {
  const titles = search.found.titles

  if (search.page !== 1) {
    return null
  }

  if (titles.length === 0) {
    return null
  }

  if (titles.length === 1) {
    return _strongTitle(titles[0], search.promotedPurpose ?? null)
  }

  return _severalTitles(titles, search.words, Boolean(search.allTitles))
}

/**
 * @private
 * The heading over the guides that have the words, under a title block, to
 * say how they differ from it; none without one. A guide the block names is
 * among them too when its sections have the words, as the search service
 * gives it in both.
 *
 * @param {Object|null} titleBlock
 * @param {string} words
 * @returns {string|null}
 */
function _listHeading (titleBlock, words) {
  if (!titleBlock) {
    return null
  }

  return `Sections that mention ‘${words}’`
}

/**
 * @private
 * What the list under a title block says when no guide's sections have the
 * words, so it is plain that they were searched; nothing when some do, or
 * there is no title block.
 *
 * @param {Object|null} titleBlock
 * @param {number} guideCount - The guides under it
 * @param {string} words
 * @returns {string|null}
 */
function _listEmpty (titleBlock, guideCount, words) {
  if (!titleBlock) {
    return null
  }

  if (guideCount > 0) {
    return null
  }

  return `No sections mention ‘${words}’.`
}

/**
 * @private
 * When nothing at all has the words, across every guide: what to say, with
 * what to try next; `search-results.njk` lists the suggestions.
 *
 * @param {Object} search
 * @param {string} search.words
 * @param {import('../../services/search.js').GuideResults} search.found
 * @returns {{heading: string}|null}
 */
function _noResults (search) {
  if (search.found.tooManyMatches) {
    return null
  }

  if (search.found.documentTotal > 0) {
    return null
  }

  return { heading: `There are no guides with ‘${search.words}’` }
}

/**
 * @private
 * @param {Object} search
 * @param {string} search.words
 * @param {number} search.page
 * @param {string|null} search.guide - Searched inside, if one
 * @param {{total: number, documentTotal?: number, tooManyMatches: boolean, results: Array<object>, titles?: Array<object>}} search.found
 * @returns {string|null} Why there are no results to list, if there are
 *   none and nothing else says so: across every guide, `_noResults` says when
 *   nothing has the words, and `_listEmpty` when only titles do
 */
function _searchEmptyMessage (search) {
  if (search.found.tooManyMatches) {
    return 'Too many matches. Use more specific words.'
  }

  if (search.guide) {
    return _guideEmptyMessage(search)
  }

  return _guidesEmptyMessage(search)
}

/**
 * @private
 * @param {Object} search - Inside one guide, as `_searchEmptyMessage` takes it
 * @returns {string|null} Why that guide has no sections to list, if none
 */
function _guideEmptyMessage (search) {
  if (search.found.total === 0) {
    return `This guide has no sections with the words “${search.words}”.`
  }

  if (search.found.results.length > 0) {
    return null
  }

  return `There is no page ${search.page} of results.`
}

/**
 * @private
 * @param {Object} search - Across every guide, as `_searchEmptyMessage` takes it
 * @returns {string|null} Why there are no guides to list, if none and nothing
 *   else says so
 */
function _guidesEmptyMessage (search) {
  const found = search.found

  if (found.results.length > 0) {
    return null
  }

  if (found.documentTotal === 0) {
    return null
  }

  if (search.page !== 1) {
    return `There is no page ${search.page} of results.`
  }

  if (found.titles.length > 0) {
    return null
  }

  return `There is no page ${search.page} of results.`
}

/**
 * @private
 * The count line under the heading: how many sections have the words, or,
 * when only titles do, that none do; nothing when nothing has them.
 *
 * @param {import('../../services/search.js').GuideResults} found
 * @returns {string|null}
 */
function _guidesSummary (found) {
  if (found.tooManyMatches) {
    return null
  }

  if (found.documentTotal === 0) {
    return null
  }

  if (found.sectionTotal === 0) {
    return 'No sections with these words'
  }

  return _counted(found.sectionTotal, 'match', 'matches')
}

/**
 * @private
 * The guides that have the words, each with its best sections, as
 * `search-results.njk` shows them, under the guides whose title they cover.
 *
 * @param {Object} search
 * @param {string} search.words
 * @param {number} search.page
 * @param {string|null} [search.promotedPurpose] - What the one guide whose
 *   title the words cover is for, if known
 * @param {import('../../services/search.js').GuideResults} search.found
 * @returns {Object}
 */
function _buildGuidesSearch (search) {
  const found = search.found
  const guides = found.tooManyMatches ? [] : found.results.map((guide) => _guideGroup(guide, search.words))
  const titleBlock = found.tooManyMatches ? null : _titleBlock(search)
  const listHeading = _listHeading(titleBlock, search.words)

  return {
    words: search.words,
    heading: _counted(found.documentTotal, 'guide', 'guides'),
    summary: _guidesSummary(found),
    backLink: null,
    emptyMessage: _searchEmptyMessage(search),
    noResults: _noResults(search),
    titleBlock,
    listHeading,
    listEmpty: _listEmpty(titleBlock, guides.length, search.words),
    guideHeadingLevel: listHeading ? GUIDE_HEADING_LEVEL_UNDER_LIST : GUIDE_HEADING_LEVEL,
    guides,
    results: [],
    pagination: searchPagination({ words: search.words, page: search.page, total: found.total, tooManyMatches: found.tooManyMatches })
  }
}

/**
 * @private
 * One guide's sections that have the words, as `search-results.njk` shows
 * them, with a way back to every guide that has them.
 *
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
    heading: _counted(found.total, 'match', 'matches'),
    summary: guideTitle ? `In ${guideTitle}` : null,
    backLink: { href: searchHref({ words: search.words }), text: 'All guides with these words' },
    emptyMessage: _searchEmptyMessage(search),
    noResults: null,
    titleBlock: null,
    listHeading: null,
    listEmpty: null,
    guideHeadingLevel: GUIDE_HEADING_LEVEL,
    guides: [],
    results: found.tooManyMatches ? [] : found.results.map((result) => _searchRow(result, false)),
    pagination: searchPagination({ words: search.words, guide: search.guide, page: search.page, total: found.total, tooManyMatches: found.tooManyMatches })
  }
}

/**
 * @private
 * The results of searching the guides, or one guide, as
 * `search-results.njk` shows them.
 *
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
   * @param {{words: string, page: number, guide: string|null, promotedPurpose?: string|null, allTitles?: boolean, found: import('../../services/search.js').GuideResults|import('../../services/search.js').SearchResults}|null} [data.search=null]
   *   - What searching for the words found, shown instead of the list: the
   *   guides that have them and those whose title they cover, or with
   *   `guide`, that guide's sections
   * @param {boolean} [data.searchUnavailable=false] - Searching failed, so the
   *   list is shown with a warning instead
   * @param {boolean} [data.wordsTooLong=false] - The words are too long to
   *   search for, so the list is shown with an error instead
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
      wordsTooLong = false,
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
    this.wordsTooLong = wordsTooLong
  }
}

export {
  HUB_MESSAGES,
  HubViewModel
}
