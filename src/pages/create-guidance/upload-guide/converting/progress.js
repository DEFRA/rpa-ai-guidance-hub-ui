import { getStagedDocumentById } from '../../../../services/staged-documents.js'

const PERCENT = 100

/**
 * What the converting page says when saving the document cannot go on, named
 * once, so that one test holds their words and the rest name them. Each
 * `…Detail` says what to do about the one before it.
 */
const CONVERSION_MESSAGES = Object.freeze({
  failed: 'The document could not be converted',
  failedDetail: 'Go back to check your answers and select Convert document again. If this keeps happening, contact the support team',
  expired: 'The uploaded document has expired',
  expiredDetail: 'Start over and upload it again'
})

const FAILED = { message: CONVERSION_MESSAGES.failed, detail: CONVERSION_MESSAGES.failedDetail }

const EXPIRED = { message: CONVERSION_MESSAGES.expired, detail: CONVERSION_MESSAGES.expiredDetail }

/**
 * How far saving the converted document has got, as the converting page
 * shows it. The API saves it in steps - one per picture, then the content -
 * and the staging record of the file counts them.
 *
 * @param {string} fileId
 * @returns {Promise<{percentage: number, label: string, isComplete: boolean,
 *   isError: boolean, message: string|null, detail: string|null}>}
 */
async function getConversionProgress (fileId) {
  const stagedDocument = await getStagedDocumentById(fileId)

  if (!stagedDocument) {
    return _progress({ percentage: 0, label: 'Upload expired', isError: true, ...EXPIRED })
  }

  const { savingStatus, saveStepsCompleted, saveStepsTotal } = stagedDocument
  const percentage = _percentage(saveStepsCompleted, saveStepsTotal)

  if (savingStatus === 'complete') {
    return _progress({ percentage: PERCENT, label: 'Document converted', isComplete: true })
  }

  if (savingStatus === 'failed') {
    return _progress({ percentage, label: 'Conversion failed', isError: true, ...FAILED })
  }

  if (!saveStepsTotal) {
    return _progress({ percentage: 0, label: 'Starting to convert the document' })
  }

  return _progress({
    percentage,
    label: `Saving the document: ${saveStepsCompleted} of ${saveStepsTotal} parts saved`
  })
}

/**
 * @private
 * @param {number|null} completed
 * @param {number|null} total
 * @returns {number}
 */
function _percentage (completed, total) {
  return total ? Math.floor(((completed ?? 0) / total) * PERCENT) : 0
}

/**
 * @private
 */
function _progress ({ percentage, label, isComplete = false, isError = false, message = null, detail = null }) {
  return { percentage, label, isComplete, isError, message, detail }
}

export {
  CONVERSION_MESSAGES,
  getConversionProgress
}
