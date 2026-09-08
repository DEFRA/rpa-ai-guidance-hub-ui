/**
 * Shared identifiers for the guide-upload processing flow.
 *
 * @readonly
 * @enum {string}
 */
const STEP_IDS = {
  INITIAL: 'initial',
  SCANNING: 'scanning'
}

/**
 * @readonly
 * @enum {string}
 */
const STATUS_IDS = {
  INITIAL: 'initial',
  UPLOADER_PENDING: 'uploader:pending',
  UPLOADER_COMPLETE: 'uploader:complete',
  UPLOADER_FAILED: 'uploader:failed'
}

/**
 * Ordered list of all processing steps for guide uploads.
 *
 * Status ID convention: prefix with the downstream system it comes from,
 * e.g. `uploader:pending`, `conversion:processing`, to avoid collisions and
 * make it obvious which system a state belongs to.
 *
 * @type {Array<{id: string, label: string}>}
 */
const STEPS = [
  { id: STEP_IDS.INITIAL, label: 'Checking your file' },
  { id: STEP_IDS.SCANNING, label: 'Scanning for viruses' }
]

/**
 * Derived once at module load from STEPS. Maps status IDs to their step state
 * (step reference, label, percentage, error flag).
 *
 * @type {Object<string, {stepId: string, label: string, currentIndex: number, percentage: number, isError: boolean}>}
 */
const STEP_STATE_BY_STATUS = {
  [STATUS_IDS.INITIAL]: {
    stepId: STEP_IDS.INITIAL,
    label: 'Checking your file',
    currentIndex: 0,
    percentage: 25,
    isError: false
  },
  [STATUS_IDS.UPLOADER_PENDING]: {
    stepId: STEP_IDS.SCANNING,
    label: 'Scanning for viruses',
    currentIndex: 1,
    percentage: 50,
    isError: false
  },
  [STATUS_IDS.UPLOADER_COMPLETE]: {
    stepId: STEP_IDS.SCANNING,
    label: 'File scanned successfully',
    currentIndex: 2,
    percentage: 100,
    isError: false
  },
  [STATUS_IDS.UPLOADER_FAILED]: {
    stepId: STEP_IDS.SCANNING,
    label: 'Scan failed',
    currentIndex: 1,
    percentage: 50,
    isError: true
  }
}

/**
 * Look up the step state for a given status ID.
 * Falls back to 'uploader:pending' for unknown statuses.
 *
 * @param {string} statusId
 * @returns {Object} Step state {stepId, label, currentIndex, percentage, isError}
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
