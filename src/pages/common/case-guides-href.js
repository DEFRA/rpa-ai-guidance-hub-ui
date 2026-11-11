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

export {
  caseGuidesHref
}
