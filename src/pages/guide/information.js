import { keepPreferences, preferencesOf } from '../../services/preferences.js'

/**
 * Whether the user chose to show a guide's information under its title, for
 * every guide they read. Hidden until they do.
 *
 * @param {import('@hapi/hapi').Request} request
 * @returns {Promise<boolean>}
 */
async function isInformationShown (request) {
  return (await preferencesOf(request)).guideInformationShown === true
}

/**
 * @param {import('@hapi/hapi').Request} request
 * @param {boolean} shown
 * @returns {Promise<void>}
 */
async function setInformationShown (request, shown) {
  await keepPreferences(request, { guideInformationShown: shown })
}

export {
  isInformationShown,
  setInformationShown
}
