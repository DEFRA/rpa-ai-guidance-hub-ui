import {
  keepPreferences,
  preferencesOf
} from '../../services/preferences.js'

// The whole guide on one page, or a section at a time, as the prototype
// names them.
const GUIDE_FORMATS = Object.freeze([
  { value: 'traditional', text: 'Traditional' },
  { value: 'stepper', text: 'Stepper' }
])

// User research found that readers want the whole guide when they open it.
const DEFAULT_GUIDE_FORMAT = GUIDE_FORMATS[0].value

/**
 * How the user chose to read guides: every guide the same way, on any
 * device.
 *
 * @param {import('@hapi/hapi').Request} request - Signed in
 * @returns {Promise<string>} One of `GUIDE_FORMATS`' values
 */
async function getGuideFormat (request) {
  const { guideFormat } = await preferencesOf(request)
  const offered = GUIDE_FORMATS.some(option => option.value === guideFormat)

  return offered ? guideFormat : DEFAULT_GUIDE_FORMAT
}

/**
 * @param {import('@hapi/hapi').Request} request - Signed in
 * @param {string} format - One of `GUIDE_FORMATS`' values
 * @returns {Promise<void>}
 * @throws {GuidanceApiError} When the API cannot keep it
 */
async function setGuideFormat (request, format) {
  await keepPreferences(request, { guideFormat: format })
}

export {
  getGuideFormat,
  GUIDE_FORMATS,
  setGuideFormat
}
