import { keepPreferences, preferencesOf } from '../../services/preferences.js'

// The whole guide on one page, or a section at a time, as the prototype
// names them.
const GUIDE_FORMATS = Object.freeze([
  { value: 'traditional', text: 'Traditional' },
  { value: 'stepper', text: 'Stepper' }
])

// User research found that readers want the whole guide when they open it.
const DEFAULT_GUIDE_FORMAT = GUIDE_FORMATS[0].value

/**
 * How the user chose to read guides: every guide the same way.
 *
 * @param {import('@hapi/hapi').Request} request
 * @returns {Promise<string>} One of `GUIDE_FORMATS`' values
 */
async function getGuideFormat (request) {
  const { guideFormat } = await preferencesOf(request)

  return GUIDE_FORMATS.some(option => option.value === guideFormat) ? guideFormat : DEFAULT_GUIDE_FORMAT
}

/**
 * @param {import('@hapi/hapi').Request} request
 * @param {string} format - One of `GUIDE_FORMATS`' values
 * @returns {Promise<void>}
 */
async function setGuideFormat (request, format) {
  await keepPreferences(request, { guideFormat: format })
}

export {
  getGuideFormat,
  GUIDE_FORMATS,
  setGuideFormat
}
