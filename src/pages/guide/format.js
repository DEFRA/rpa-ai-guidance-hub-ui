const SESSION_KEY = 'guide-format'

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
 * @returns {string} One of `GUIDE_FORMATS`' values
 */
function getGuideFormat (request) {
  const format = request.yar.get(SESSION_KEY)

  return GUIDE_FORMATS.some(option => option.value === format) ? format : DEFAULT_GUIDE_FORMAT
}

/**
 * @param {import('@hapi/hapi').Request} request
 * @param {string} format - One of `GUIDE_FORMATS`' values
 */
function setGuideFormat (request, format) {
  request.yar.set(SESSION_KEY, format)
}

export {
  getGuideFormat,
  GUIDE_FORMATS,
  setGuideFormat
}
