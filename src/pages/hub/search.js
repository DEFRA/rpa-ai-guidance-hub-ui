/**
 * @module The hub's search: which page of results the address asks for, and
 * the GOV.UK pagination between them. The words live in the address (`q`), as
 * the filters do, so a search can be shared and bookmarked. So does the guide
 * being searched inside (`guide`), when the search is of one guide's
 * sections rather than every guide.
 */

// A guide's id: a UUID, as every guide's is.
const GUIDE_ID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i

const RESULTS_PER_PAGE = 10

// Pages either side of the current one that the pagination numbers.
const NEIGHBOURS = 1

/**
 * The page of results asked for in the address (`page`), from 1; the first
 * for anything but a whole number from 1.
 *
 * @param {Object} query - The request's query
 * @returns {number}
 */
function pageFrom (query = {}) {
  if (typeof query.page !== 'string' || !/^\d+$/.test(query.page)) {
    return 1
  }

  const page = Number(query.page)

  if (!Number.isSafeInteger(page) || page < 1) {
    return 1
  }

  return page
}

/**
 * The guide to search inside, from the address (`guide`); null for every
 * guide, as for anything but one guide's id.
 *
 * @param {Object} query - The request's query
 * @returns {string|null}
 */
function guideFrom (query = {}) {
  if (typeof query.guide !== 'string' || !GUIDE_ID.test(query.guide)) {
    return null
  }

  return query.guide.toLowerCase()
}

/**
 * Whether the address asks for every guide whose title the words cover
 * (`titles=all`), rather than the first few.
 *
 * @param {Object} query - The request's query
 * @returns {boolean}
 */
function allTitlesFrom (query = {}) {
  return query.titles === 'all'
}

/**
 * The address of a page of results for these words: the guide only when
 * searching inside one, the page only when it is not the first, and every
 * covered title only when asked for.
 *
 * @param {Object} options
 * @param {string} options.words
 * @param {string|null} [options.guide]
 * @param {number} [options.page]
 * @param {boolean} [options.allTitles]
 * @returns {string}
 */
function searchHref (options) {
  const params = new URLSearchParams({ q: options.words })

  if (options.guide) {
    params.set('guide', options.guide)
  }

  if (options.page > 1) {
    params.set('page', String(options.page))
  }

  if (options.allTitles) {
    params.set('titles', 'all')
  }

  return `/hub?${params.toString()}`
}

/**
 * @private
 * The pages the pagination numbers: the first, the last and the current one
 * with its neighbours, an ellipsis (null) for each run left out.
 *
 * @param {number} page
 * @param {number} pages
 * @returns {Array<number|null>}
 */
function _numbered (page, pages) {
  const shown = []

  for (let number = 1; number <= pages; number++) {
    const near = Math.abs(number - page) <= NEIGHBOURS

    if (number === 1 || number === pages || near) {
      shown.push(number)
    } else if (shown.at(-1) !== null) {
      shown.push(null)
    }
  }

  return shown
}

/**
 * The `govukPagination` parameters between pages of results, or null when
 * they fit on one page, or when there are too many to give.
 *
 * @param {Object} options
 * @param {string} options.words
 * @param {string|null} [options.guide] - Searched inside, if one
 * @param {number} options.page - The current one
 * @param {number} options.total - Every matching result
 * @param {boolean} [options.tooManyMatches]
 * @returns {Object|null}
 */
function searchPagination (options) {
  const pages = Math.ceil(options.total / RESULTS_PER_PAGE)

  if (options.tooManyMatches || pages <= 1) {
    return null
  }

  const href = (page) => searchHref({ words: options.words, guide: options.guide, page })
  const page = options.page

  return {
    previous: page > 1 ? { href: href(Math.min(page - 1, pages)) } : null,
    next: page < pages ? { href: href(page + 1) } : null,
    items: _numbered(page, pages).map((number) => {
      if (number === null) {
        return { ellipsis: true }
      }

      return { number, href: href(number), current: number === page }
    })
  }
}

export {
  allTitlesFrom,
  guideFrom,
  pageFrom,
  RESULTS_PER_PAGE,
  searchHref,
  searchPagination
}
