const CONVERTING_URL = '/create-guidance/upload-guide/converting'

/**
 * View model for the page shown while a slow conversion carries on.
 */
class ConvertingViewModel {
  pageTitle = 'Converting this document is taking a long time'
  checkAgainUrl = CONVERTING_URL
  page = 'upload-guide-converting'
}

export {
  ConvertingViewModel
}
