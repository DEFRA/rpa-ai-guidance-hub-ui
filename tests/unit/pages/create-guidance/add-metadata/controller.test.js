import { statusCodes } from '../../../../../src/constants/status-codes.js'
import { getMetadataForm } from '../../../../../src/pages/create-guidance/metadata/controller.js'

const MIGRATE_METADATA_VIEW = 'create-guidance/metadata/page.njk'

describe('getMetadataForm', () => {
  let request, h, code

  beforeEach(() => {
    request = {
      yar: {
        get: vi.fn(),
        flash: vi.fn(() => [])
      }
    }
    code = vi.fn()
    h = {
      view: vi.fn(() => ({ code }))
    }
  })

  test('renders the form with values from saved session metadata', async () => {
    request.yar.get.mockReturnValue({ metadata: { guidanceType: 'process' } })

    await getMetadataForm(request, h)

    expect(h.view).toHaveBeenCalledWith(MIGRATE_METADATA_VIEW, expect.objectContaining({
      values: { guidanceType: 'process' }
    }))
  })

  test('responds with 200', async () => {
    await getMetadataForm(request, h)

    expect(code).toHaveBeenCalledWith(statusCodes.HTTP_STATUS_OK)
  })

  test('carries through an upload notification flash message when one is set', async () => {
    request.yar.flash.mockReturnValue(['You have already uploaded a document for this guide'])

    await getMetadataForm(request, h)

    expect(request.yar.flash).toHaveBeenCalledWith('uploadNotification')
    expect(h.view).toHaveBeenCalledWith(MIGRATE_METADATA_VIEW, expect.objectContaining({
      notification: 'You have already uploaded a document for this guide'
    }))
  })

  test('renders without a notification when no flash message is set', async () => {
    await getMetadataForm(request, h)

    expect(h.view).toHaveBeenCalledWith(MIGRATE_METADATA_VIEW, expect.objectContaining({
      notification: null
    }))
  })
})
