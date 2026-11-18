/**
 * The address of the Bookmarked guides page narrowed to one of the user's
 * cases. It names the case by its key, as its case ID or SBI must not be in
 * an address: analytics and the service's logs record each one.
 *
 * @param {string} key - The case's
 * @returns {string}
 */
function caseGuidesHref (key) {
  return `/hub/bookmarked-guides?case=${encodeURIComponent(key)}`
}

/**
 * A page's address no longer narrowed to the case with this key, the other
 * filters kept: once the user has removed the case, its address is not found.
 *
 * @param {string} href - One of ours, relative, as `backTo` makes it
 * @param {string} key - The case's
 * @returns {string}
 */
function withoutCase (href, key) {
  const url = new URL(href, 'https://same-origin.invalid')

  if (url.searchParams.get('case') !== key) {
    return href
  }

  url.searchParams.delete('case')

  return `${url.pathname}${url.search}${url.hash}`
}

export {
  caseGuidesHref,
  withoutCase
}
