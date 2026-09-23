const BACK_URL = '/create-guidance/upload-guide/metadata/purpose'
const HUB_URL = '/hub'
const METADATA_URL = '/create-guidance/upload-guide/metadata'
const PURPOSE_URL = '/create-guidance/upload-guide/metadata/purpose'

/**
 * Resolve a list of selected reference values to their labels, falling
 * back to the raw value for anything the current option list doesn't know
 *
 * @private
 * @param {Array<string>} [values]
 * @param {Array<{value: string, label: string}>} [options]
 * @returns {Array<string>}
 */
function _labelsFor (values = [], options = []) {
  const labelByValue = new Map(options.map((option) => [option.value, option.label]))

  return values.map((value) => labelByValue.get(value) ?? value)
}

/**
 * CheckAnswersViewModel - Summary of everything captured across the
 * metadata screens.
 *
 * This is the placeholder end of the journey until the guidance API can
 * persist metadata; nothing is submitted from here.
 */
class CheckAnswersViewModel {
  /**
   * @param {Object} [data={}]
   * @param {Array<{key: string, value?: string, values?: Array<string>, changeUrl: string}>} [data.rows=[]]
   * @param {string} [data.backUrl]
   */
  constructor (data = {}) {
    this.rows = data.rows || []
    this.backUrl = data.backUrl || BACK_URL
    this.hubUrl = HUB_URL
  }

  /**
   * Build the summary rows from session metadata and the reference option
   * lists needed to label the checkbox answers
   */
  static fromSession ({ metadata = {}, schemeOptions = [], systemOptions = [], audienceOptions = [] } = {}) {
    return new CheckAnswersViewModel({
      rows: [
        { key: 'Guidance title', value: metadata.guideTitle, changeUrl: METADATA_URL },
        { key: 'Schemes', values: _labelsFor(metadata.schemes, schemeOptions), changeUrl: METADATA_URL },
        { key: 'Owner email', value: metadata.owner, changeUrl: PURPOSE_URL },
        { key: 'Purpose', value: metadata.goal, changeUrl: PURPOSE_URL },
        { key: 'Required knowledge and training', value: metadata.requirements, changeUrl: PURPOSE_URL },
        { key: 'Systems', values: _labelsFor(metadata.systems, systemOptions), changeUrl: PURPOSE_URL },
        { key: 'Audience', values: _labelsFor(metadata.audience, audienceOptions), changeUrl: PURPOSE_URL }
      ]
    })
  }

  pageTitle = 'Check your answers'
  page = 'upload-guide-metadata'
}

export {
  CheckAnswersViewModel
}
