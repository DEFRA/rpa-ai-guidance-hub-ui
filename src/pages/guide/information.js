import {
  keepPreferences,
  preferencesOf
} from '../../services/preferences.js'

/**
 * Whether the user chose to show a guide's information under its title, for
 * every guide they read, on any device. Hidden until they do.
 *
 * @param {import('@hapi/hapi').Request} request - Signed in
 * @returns {Promise<boolean>}
 */
async function isInformationShown (request) {
  const { guideInformationShown } = await preferencesOf(request)

  return guideInformationShown === true
}

/**
 * @param {import('@hapi/hapi').Request} request - Signed in
 * @param {boolean} shown
 * @returns {Promise<void>}
 * @throws {GuidanceApiError} When the API cannot keep it
 */
async function setInformationShown (request, shown) {
  await keepPreferences(request, { guideInformationShown: shown })
}

export {
  isInformationShown,
  setInformationShown
}
