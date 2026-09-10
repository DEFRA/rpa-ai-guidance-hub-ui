/**
 * Shared identifiers for the guide-upload processing flow.
 *
 * @readonly
 * @enum {string}
 */
const STEP_IDS = {
  SCANNING: 'scanning',
  MINIMAL_PARSE: 'minimalParse'
}

/**
 * Status ID convention: prefix with the downstream system it comes from,
 * e.g. `uploader:pending`, `conversion:processing`, to avoid collisions and
 * make it obvious which system a state belongs to.
 *
 * @readonly
 * @enum {string}
 */
const STATUS_IDS = {
  UPLOADER_PENDING: 'uploader:pending',
  UPLOADER_COMPLETE: 'uploader:complete',
  UPLOADER_FAILED: 'uploader:failed',
  UPLOADER_REJECTED: 'uploader:rejected',
  UPLOADER_NO_FILE: 'uploader:no-file',
  UPLOADER_MISSING: 'uploader:missing',
  MINIMAL_PARSE_STARTED: 'minimal-parse:started',
  MINIMAL_PARSE_PENDING: 'minimal-parse:in-progress',
  MINIMAL_PARSE_COMPLETE: 'minimal-parse:complete',
  MINIMAL_PARSE_FAILED: 'minimal-parse:failed'
}

/**
 * Ordered list of all processing steps for guide uploads.
 *
 * @type {Array<{id: string, label: string}>}
 */
const STEPS = [
  { id: STEP_IDS.SCANNING, label: 'Scanning for viruses' },
  { id: STEP_IDS.MINIMAL_PARSE, label: 'Parsing document' }
]

/**
 * Maps status IDs to their step state. Error states carry a default,
 * user-facing `message`; cdp-uploader supplies a more specific one for
 * rejected files, which takes precedence.
 *
 * @type {Object<string, {stepId: string, label: string, percentage: number, isError: boolean, message?: string}>}
 */
const STEP_STATE_BY_STATUS = {
  [STATUS_IDS.UPLOADER_PENDING]: {
    stepId: STEP_IDS.SCANNING,
    label: 'Scanning for viruses',
    percentage: 50,
    isError: false
  },
  [STATUS_IDS.UPLOADER_COMPLETE]: {
    stepId: STEP_IDS.SCANNING,
    label: 'File scanned successfully',
    percentage: 100,
    isError: false
  },
  [STATUS_IDS.UPLOADER_FAILED]: {
    stepId: STEP_IDS.SCANNING,
    label: 'Scan failed',
    percentage: 50,
    isError: true,
    message: 'The selected file could not be checked. Upload it again.'
  },
  [STATUS_IDS.UPLOADER_REJECTED]: {
    stepId: STEP_IDS.SCANNING,
    label: 'File rejected',
    percentage: 50,
    isError: true,
    message: 'The selected file could not be uploaded. Upload a different file.'
  },
  [STATUS_IDS.UPLOADER_NO_FILE]: {
    stepId: STEP_IDS.SCANNING,
    label: 'No file uploaded',
    percentage: 50,
    isError: true,
    message: 'Select a Word document to upload.'
  },
  [STATUS_IDS.UPLOADER_MISSING]: {
    stepId: STEP_IDS.SCANNING,
    label: 'Upload not found',
    percentage: 50,
    isError: true,
    message: 'Your upload could not be found. Upload the document again.'
  },
  [STATUS_IDS.MINIMAL_PARSE_STARTED]: {
    stepId: STEP_IDS.MINIMAL_PARSE,
    label: 'Parsing document',
    percentage: 60,
    isError: false
  },
  [STATUS_IDS.MINIMAL_PARSE_PENDING]: {
    stepId: STEP_IDS.MINIMAL_PARSE,
    label: 'Parsing document',
    percentage: 75,
    isError: false
  },
  [STATUS_IDS.MINIMAL_PARSE_COMPLETE]: {
    stepId: STEP_IDS.MINIMAL_PARSE,
    label: 'Document parsed successfully',
    percentage: 100,
    isError: false
  },
  [STATUS_IDS.MINIMAL_PARSE_FAILED]: {
    stepId: STEP_IDS.MINIMAL_PARSE,
    label: 'Parsing failed',
    percentage: 75,
    isError: true,
    message: 'The document could not be parsed. Upload it again.'
  }
}

/**
 * Look up the step state for a given status ID.
 * Falls back to 'uploader:pending' for unknown statuses.
 *
 * @param {string} statusId
 * @returns {{stepId: string, label: string, percentage: number, isError: boolean, message?: string}}
 */
function getStepState (statusId) {
  return STEP_STATE_BY_STATUS[statusId] ?? STEP_STATE_BY_STATUS[STATUS_IDS.UPLOADER_PENDING]
}

export {
  STEP_IDS,
  STATUS_IDS,
  STEPS,
  getStepState
}
