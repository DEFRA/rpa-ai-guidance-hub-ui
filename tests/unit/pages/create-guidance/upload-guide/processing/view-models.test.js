import { UploadProcessingViewModel } from '../../../../../../src/pages/create-guidance/upload-guide/processing/view-models.js'

describe('UploadProcessingViewModel', () => {
  test('polls the session-scoped status endpoint', () => {
    const viewModel = new UploadProcessingViewModel()

    expect(viewModel.pollUrl).toBe('/create-guidance/upload-guide/processing/status')
  })

  test('points at the metadata page as the redirect target and the upload form for retries', () => {
    const viewModel = new UploadProcessingViewModel()

    expect(viewModel.redirectUrl).toBe('/create-guidance/metadata')
    expect(viewModel.retryUrl).toBe('/create-guidance/upload-guide')
  })

  test('uses default label and percentage when not provided', () => {
    const viewModel = new UploadProcessingViewModel()

    expect(viewModel.label).toBe('Scanning for viruses')
    expect(viewModel.percentage).toBe(0)
    expect(viewModel.isComplete).toBe(false)
    expect(viewModel.isError).toBe(false)
    expect(viewModel.errorMessage).toBeNull()
  })

  test('uses provided label and percentage', () => {
    const viewModel = new UploadProcessingViewModel({
      label: 'File scanned successfully',
      percentage: 100
    })

    expect(viewModel.label).toBe('File scanned successfully')
    expect(viewModel.percentage).toBe(100)
  })

  test('refreshes for no-JavaScript users only while there is something to wait for', () => {
    expect(new UploadProcessingViewModel().refreshSeconds).toBe(5)
    expect(new UploadProcessingViewModel({ isComplete: true }).refreshSeconds).toBeNull()
    expect(new UploadProcessingViewModel({ isError: true }).refreshSeconds).toBeNull()
  })

  test('exposes the error message and prefixes the title when processing failed', () => {
    const viewModel = new UploadProcessingViewModel({
      isError: true,
      message: 'The selected file contains a virus'
    })

    expect(viewModel.isError).toBe(true)
    expect(viewModel.errorMessage).toBe('The selected file contains a virus')
    expect(viewModel.pageTitle).toBe('Error: Checking your file')
  })

  test('ignores a message when there is no error', () => {
    const viewModel = new UploadProcessingViewModel({ message: 'ignored' })

    expect(viewModel.errorMessage).toBeNull()
  })

  test('sets the page title and page name', () => {
    const viewModel = new UploadProcessingViewModel()

    expect(viewModel.pageTitle).toBe('Checking your file')
    expect(viewModel.page).toBe('upload processing')
  })
})
