const SESSION_KEY = 'guide-reading-width'

const READING_WIDTHS = Object.freeze([
  { value: 'standard', text: 'Standard' },
  { value: 'wide', text: 'Wide' },
  { value: 'full', text: 'Full width' }
])

const DEFAULT_READING_WIDTH = READING_WIDTHS[0].value

/**
 * @param {unknown} width
 * @returns {boolean} Whether `width` is one of the offered widths
 */
function isReadingWidth (width) {
  return READING_WIDTHS.some(option => option.value === width)
}

/**
 * The page width the user chose, for every guide they read.
 *
 * @param {import('@hapi/hapi').Request} request
 * @returns {string} One of `READING_WIDTHS`' values
 */
function getReadingWidth (request) {
  const width = request.yar.get(SESSION_KEY)

  return isReadingWidth(width) ? width : DEFAULT_READING_WIDTH
}

/**
 * @param {import('@hapi/hapi').Request} request
 * @param {string} width - One of `READING_WIDTHS`' values
 */
function setReadingWidth (request, width) {
  request.yar.set(SESSION_KEY, width)
}

export {
  getReadingWidth,
  isReadingWidth,
  READING_WIDTHS,
  setReadingWidth
}
