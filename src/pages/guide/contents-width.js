import { preferencesOf } from '../../services/preferences.js'

/**
 * The guide's contents column, in pixels, as the prototype has it. The
 * stylesheet's `$app-guide-toc-width` matches the default.
 */
const CONTENTS_WIDTH = Object.freeze({ min: 240, max: 560, default: 340 })

/**
 * The width the user left the contents pane at, on any device.
 *
 * @param {import('@hapi/hapi').Request} request - Signed in
 * @returns {Promise<number>} In pixels
 */
async function getContentsWidth (request) {
  const { contentsWidth } = await preferencesOf(request)

  return contentsWidth ?? CONTENTS_WIDTH.default
}

export { CONTENTS_WIDTH, getContentsWidth }
