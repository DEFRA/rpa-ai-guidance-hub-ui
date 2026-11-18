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
 * The side navigation's queries, for what it shows beside the page's own
 * content; it is found as a screen reader finds it, by its role and name.
 *
 * @param {ReturnType<typeof pageOf>} page
 * @returns {ReturnType<typeof within>}
 */
function sideNavOf (page) {
  return within(within(page.document.body).getByRole('navigation', { name: 'Guidance hub' }))
}

/**
 * The GOV.UK error summary's queries - its title, and a link to each field in
 * error - found as a screen reader finds it: as the page's alert.
 *
 * @param {ReturnType<typeof pageOf>} page
 * @returns {ReturnType<typeof within>}
 */
function errorSummaryOf (page) {
  return within(page.getByRole('alert'))
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

/**
 * The text a reader gets from a piece of the hub's own HTML, such as a message
 * that bolds the name of a control: to find it on a page by its words.
 *
 * @param {string} html
 * @returns {string}
 */
function textOf (html) {
  return JSDOM.fragment(html).textContent
}

export {
  errorSummaryOf,
  pageOf,
  sideNavOf,
  summaryValueOf,
  textOf
}
