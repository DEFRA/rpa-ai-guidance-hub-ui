import { UploadGuidanceViewModel } from '../../../../../src/pages/create-guidance/upload-guide/view-models.js'
import { CDP_UPLOADER_BROWSER_URL } from '../../../../../src/constants/uploader.js'

describe('UploadGuidanceViewModel', () => {
  test('builds the upload URL from the upload id', () => {
    const viewModel = new UploadGuidanceViewModel({ uploadId: 'u-1' })

    expect(viewModel.uploadUrl).toBe(`${CDP_UPLOADER_BROWSER_URL}/u-1`)
  })
})
