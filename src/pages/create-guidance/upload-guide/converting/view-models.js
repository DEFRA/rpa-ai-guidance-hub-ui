const CONVERTING_URL = '/create-guidance/upload-guide/converting'

/**
 * View model for the page shown while a slow conversion carries on. Its
 * wording follows the processing page's own "taking longer than expected"
 * message.
 */
class ConvertingViewModel {
  pageTitle = 'Document conversion'
  convertingUrl = CONVERTING_URL
  page = 'upload-guide-converting'
}

export {
  ConvertingViewModel
}
