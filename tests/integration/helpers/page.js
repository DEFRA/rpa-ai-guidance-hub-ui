import { configure, within } from '@testing-library/dom'
import { JSDOM } from 'jsdom'

// A query that finds nothing says what it looked for and what the page has
// instead; the page's whole HTML after that would bury it.
configure({
  getElementError (message) {
    const error = new Error(message)
    error.name = 'TestingLibraryElementError'

    return error
  }
})

/**
 * A rendered page, to find what a test checks the way a user finds it - by
 * its role and name, its label or its text - with Testing Library's queries,
 * rather than by matching the HTML as a string.
 *
 * The queries look in the page's own content (`main`), so what a failure
 * lists is that, not the header and side navigation around it; `document` has
 * the whole page.
 *
 * @param {string} html - A response's payload
 * @returns {ReturnType<typeof within> & {document: Document}}
 */
function pageOf (html) {
  const { document } = new JSDOM(html).window

  return { document, ...within(document.querySelector('main')) }
}

/**
 * The value that a GOV.UK summary list gives for a key, found by the key's
 * text.
 *
 * @param {ReturnType<typeof pageOf>} page
 * @param {string} key
 * @returns {Element}
 */
function summaryValueOf (page, key) {
  return page.getByText(key, { selector: '.govuk-summary-list__key' }).nextElementSibling
}

export {
  pageOf,
  summaryValueOf
}
