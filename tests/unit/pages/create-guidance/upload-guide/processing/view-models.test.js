import { STEPS } from '../../../../../../src/pages/create-guidance/upload-guide/steps.js'
import { UploadProcessingViewModel } from '../../../../../../src/pages/create-guidance/upload-guide/processing/view-models.js'

describe('UploadProcessingViewModel', () => {
  test('builds the poll URL from the upload id', () => {
    const viewModel = new UploadProcessingViewModel({ uploadId: 'u-1' })

    expect(viewModel.pollUrl).toBe('/status-poll/u-1')
  })

  test('sets poll URL to null when no upload id is given', () => {
    const viewModel = new UploadProcessingViewModel()

    expect(viewModel.pollUrl).toBe(null)
  })

  test('points at the metadata page as the redirect target', () => {
    const viewModel = new UploadProcessingViewModel({ uploadId: 'u-1' })

    expect(viewModel.redirectUrl).toBe('/create-guidance/metadata')
  })

  test('exposes the full step list', () => {
    const viewModel = new UploadProcessingViewModel({ uploadId: 'u-1' })

    expect(viewModel.steps).toBe(STEPS)
  })

  test('uses default label and percentage when not provided', () => {
    const viewModel = new UploadProcessingViewModel()

    expect(viewModel.label).toBe('Checking your file')
    expect(viewModel.percentage).toBe(0)
  })

  test('uses provided label and percentage', () => {
    const viewModel = new UploadProcessingViewModel({
      uploadId: 'u-1',
      label: 'Scanning for viruses',
      percentage: 50
    })

    expect(viewModel.label).toBe('Scanning for viruses')
    expect(viewModel.percentage).toBe(50)
  })

  test('tracks completion and error states', () => {
    const viewModel = new UploadProcessingViewModel({
      uploadId: 'u-1',
      isComplete: true,
      isError: false
    })

    expect(viewModel.isComplete).toBe(true)
    expect(viewModel.isError).toBe(false)
  })

  test('sets the page title and page name', () => {
    const viewModel = new UploadProcessingViewModel({ uploadId: 'u-1' })

    expect(viewModel.pageTitle).toBe('Checking your file')
    expect(viewModel.page).toBe('upload processing')
  })
})
