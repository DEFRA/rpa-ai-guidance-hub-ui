import { UploadGuidanceViewModel, UploadStatusViewModel } from '../../../../../src/pages/create-guidance/upload-guide/view-models.js'
import { CDP_UPLOADER_BROWSER_URL } from '../../../../../src/constants/uploader.js'

describe('UploadGuidanceViewModel', () => {
  test('builds the upload URL from the upload id', () => {
    const viewModel = new UploadGuidanceViewModel({ uploadId: 'u-1' })

    expect(viewModel.uploadUrl).toBe(`${CDP_UPLOADER_BROWSER_URL}/u-1`)
  })
})

describe('UploadStatusViewModel', () => {
  test('constructs default pending status view model with refresh interval', () => {
    const viewModel = new UploadStatusViewModel({ uploadId: 'u-1', uploadStatus: 'pending' })

    expect(viewModel.uploadId).toBe('u-1')
    expect(viewModel.pollUrl).toBe('/status-poll/u-1')
    expect(viewModel.isReady).toBe(false)
    expect(viewModel.isError).toBe(false)
    expect(viewModel.refreshInterval).toBe(2)
    expect(viewModel.pageHeading).toBe('Checking your document')
    expect(viewModel.caption).toBe('Create guidance')
    expect(viewModel.progressPercentage).toBe(50)
  })

  test('constructs ready status view model with no refresh interval', () => {
    const viewModel = new UploadStatusViewModel({ uploadId: 'u-1', uploadStatus: 'ready', isReady: true })

    expect(viewModel.isReady).toBe(true)
    expect(viewModel.isError).toBe(false)
    expect(viewModel.refreshInterval).toBeNull()
    expect(viewModel.progressPercentage).toBe(100)
    expect(viewModel.statusMessage).toContain('verified')
  })

  test('constructs error status view model when rejected files are present', () => {
    const viewModel = new UploadStatusViewModel({
      uploadId: 'u-1',
      uploadStatus: 'ready',
      isReady: true,
      hasRejectedFiles: true,
      files: [{ fileStatus: 'rejected', error: { code: 'virusFound', message: 'The file contains a virus' } }]
    })

    expect(viewModel.isError).toBe(true)
    expect(viewModel.errorMessage).toBe('The file contains a virus')
    expect(viewModel.errorList).toEqual([{ text: 'The file contains a virus', href: '#upload-status-error' }])
    expect(viewModel.refreshInterval).toBeNull()
    expect(viewModel.pageHeading).toBe('There is a problem')
    expect(viewModel.pageTitle).toBe('Error: Checking your document')
  })

  test('constructs error status view model when explicit error message is provided', () => {
    const viewModel = new UploadStatusViewModel({
      uploadId: 'u-1',
      errorMessage: 'Upload details could not be found'
    })

    expect(viewModel.isError).toBe(true)
    expect(viewModel.errorMessage).toBe('Upload details could not be found')
    expect(viewModel.refreshInterval).toBeNull()
  })
})
