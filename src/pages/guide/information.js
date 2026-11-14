const SESSION_KEY = 'guide-information-shown'

/**
 * Whether the user chose to show a guide's information under its title, for
 * every guide they read. Hidden until they do.
 *
 * @param {import('@hapi/hapi').Request} request
 * @returns {boolean}
 */
function isInformationShown (request) {
  return request.yar.get(SESSION_KEY) === true
}

/**
 * @param {import('@hapi/hapi').Request} request
 * @param {boolean} shown
 */
function setInformationShown (request, shown) {
  request.yar.set(SESSION_KEY, shown)
}

export {
  isInformationShown,
  setInformationShown
}
