const CHOICE_URL = '/create-guidance/upload-guide/new-or-update'

/**
 * Whether an upload is a new guide or a new version of one, and which.
 */
class ChoiceViewModel {
  pageTitle = 'Is this a new guide, or a new version of one we already have?'
  pageHref = CHOICE_URL

  /**
   * @param {Object} data
   * @param {string} [data.kind] - `new` or `update`, as chosen so far
   * @param {string} [data.guideId] - The guide chosen so far
   * @param {string} data.q - The words the guides were found by
   * @param {Array<{guideId: string, title: string}>} data.guides - The guides
   *   titled like them
   * @param {Object<string, string>} [data.errors]
   * @param {Array<{text: string, href: string}>} [data.errorList]
   */
  constructor ({ kind, guideId, q, guides, errors = {}, errorList = [] }) {
    this.kind = kind ?? null
    this.q = q
    this.guides = guides.map(guide => ({
      value: guide.guideId,
      text: guide.title,
      checked: guide.guideId === guideId
    }))
    this.errors = errors
    this.errorList = errorList
  }
}

export {
  ChoiceViewModel
}
