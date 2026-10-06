import * as guidesApi from '../../../src/infra/guidance-api/guides.js'
import { createGuide } from '../../../src/services/guides.js'

describe('guides service', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  test('sends the upload, its answers and who made it to the API', async () => {
    const createGuideSpy = vi.spyOn(guidesApi, 'createGuide')
      .mockResolvedValue({ ok: true, status: 201, data: {} })

    await createGuide({
      uploadId: 'upload-1',
      fileId: 'file-1',
      metadata: { guideTitle: 'A title' },
      user: {
        id: 'user-1',
        displayName: 'A User',
        email: 'a.user@example.com'
      }
    })

    expect(createGuideSpy).toHaveBeenCalledWith({
      source: { uploadId: 'upload-1', fileId: 'file-1' },
      metadata: { guideTitle: 'A title' },
      createdBy: { id: 'user-1', displayName: 'A User' }
    })
  })
})
