import { statusCodes } from '../../../../../../src/constants/status-codes.js'
import * as session from '../../../../../../src/pages/create-guidance/session.js'
import * as referenceDataService from '../../../../../../src/services/reference-data.js'
import {
  getMetadataForm,
  metadataFailAction,
  saveMetadata
} from '../../../../../../src/pages/create-guidance/upload-guide/metadata/controller.js'

const METADATA_VIEW = 'create-guidance/upload-guide/metadata/page.njk'

describe('upload-guide metadata controller', () => {
  let request, h, code, redirect, takeover

  beforeEach(() => {
    vi.restoreAllMocks()
    takeover = vi.fn()
    code = vi.fn(() => ({ takeover }))
    redirect = vi.fn()
    h = {
      view: vi.fn(() => ({ code })),
      redirect
    }
  })

  describe('getMetadataForm', () => {
    test('redirects to upload form if no active upload in session', async () => {
      request = { yar: { get: vi.fn(() => null) } }

      await getMetadataForm(request, h)

      expect(h.redirect).toHaveBeenCalledWith('/create-guidance/upload-guide')
    })

    test('renders the form with status 200 when active upload exists', async () => {
      const uploadMock = {
        hasUpload: vi.fn(() => true),
        activeUploadId: 'test-upload-id',
        metadata: { guideTitle: 'Existing Title' }
      }
      vi.spyOn(session, 'getGuideUpload').mockReturnValue(uploadMock)
      vi.spyOn(referenceDataService, 'getSchemes').mockResolvedValue([
        { value: 'sfi', label: 'Sustainable Farming Incentive' },
        { value: 'none', label: 'Not scheme-specific' }
      ])

      request = { yar: { get: vi.fn() } }

      await getMetadataForm(request, h)

      expect(h.view).toHaveBeenCalledWith(METADATA_VIEW, expect.objectContaining({
        values: expect.objectContaining({ guideTitle: 'Existing Title' }),
        schemeOptions: [
          { value: 'sfi', text: 'Sustainable Farming Incentive' },
          { value: 'none', text: 'Not scheme-specific', divider: 'or' }
        ]
      }))
      expect(code).toHaveBeenCalledWith(statusCodes.HTTP_STATUS_OK)
    })
  })

  describe('metadataFailAction', () => {
    test('returns 400 with validation errors on the view', async () => {
      vi.spyOn(referenceDataService, 'getSchemes').mockResolvedValue([
        { value: 'none', label: 'Not scheme-specific' }
      ])

      request = {
        payload: { guideTitle: '' },
        yar: { get: vi.fn() }
      }
      const err = {
        details: [{ path: ['guideTitle'], message: 'Enter the guidance title' }]
      }

      await metadataFailAction(request, h, err)

      expect(h.view).toHaveBeenCalledWith(METADATA_VIEW, expect.objectContaining({
        errors: { guideTitle: 'Enter the guidance title' },
        schemeOptions: [
          { value: 'none', text: 'Not scheme-specific', divider: 'or' }
        ]
      }))
      expect(code).toHaveBeenCalledWith(statusCodes.HTTP_STATUS_BAD_REQUEST)
      expect(takeover).toHaveBeenCalled()
    })

    test('redisplays a normalized scheme selection when "none" is submitted alongside another scheme', async () => {
      vi.spyOn(referenceDataService, 'getSchemes').mockResolvedValue([])

      request = {
        payload: { guideTitle: '', schemes: ['none', 'sfi'] },
        yar: { get: vi.fn() }
      }
      const err = {
        details: [{ path: ['guideTitle'], message: 'Enter the guidance title' }]
      }

      await metadataFailAction(request, h, err)

      expect(h.view).toHaveBeenCalledWith(METADATA_VIEW, expect.objectContaining({
        values: expect.objectContaining({ schemes: ['sfi'] })
      }))
    })
  })

  describe('saveMetadata', () => {
    test('redirects to upload form if no active upload in session', async () => {
      vi.spyOn(session, 'getGuideUpload').mockReturnValue(null)

      request = {
        payload: { guideTitle: 'Title' },
        yar: { get: vi.fn() }
      }

      await saveMetadata(request, h)

      expect(h.redirect).toHaveBeenCalledWith('/create-guidance/upload-guide')
    })

    test('saves metadata to session and redirects to /create-guidance/upload-guide/metadata/purpose', async () => {
      const uploadMock = {
        hasUpload: vi.fn(() => true),
        activeUploadId: 'test-upload-id'
      }
      vi.spyOn(session, 'getGuideUpload').mockReturnValue(uploadMock)
      const setMetadataSpy = vi.spyOn(session, 'setGuideUploadMetadata').mockImplementation(() => {})

      request = {
        payload: {
          guideTitle: 'Updated Guide Title',
          schemes: ['sfi']
        },
        yar: { get: vi.fn(), set: vi.fn() }
      }

      await saveMetadata(request, h)

      expect(setMetadataSpy).toHaveBeenCalledWith(request, {
        guideTitle: 'Updated Guide Title',
        schemes: ['sfi']
      })
      expect(h.redirect).toHaveBeenCalledWith('/create-guidance/upload-guide/metadata/purpose')
    })

    test('normalizes "none" out when submitted alongside another scheme', async () => {
      const uploadMock = {
        hasUpload: vi.fn(() => true),
        activeUploadId: 'test-upload-id'
      }
      vi.spyOn(session, 'getGuideUpload').mockReturnValue(uploadMock)
      const setMetadataSpy = vi.spyOn(session, 'setGuideUploadMetadata').mockImplementation(() => {})

      request = {
        payload: {
          guideTitle: 'Updated Guide Title',
          schemes: ['none', 'sfi']
        },
        yar: { get: vi.fn(), set: vi.fn() }
      }

      await saveMetadata(request, h)

      expect(setMetadataSpy).toHaveBeenCalledWith(request, {
        guideTitle: 'Updated Guide Title',
        schemes: ['sfi']
      })
    })
  })
})
