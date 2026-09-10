import { statusCodes } from '../../../../../../src/constants/status-codes.js'
import * as session from '../../../../../../src/pages/create-guidance/session.js'
import * as referenceDataService from '../../../../../../src/services/reference-data.js'
import * as draftsService from '../../../../../../src/services/drafts.js'
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
        fileId: null,
        metadata: { guideTitle: 'Existing Title' }
      }
      vi.spyOn(session, 'getGuideUpload').mockReturnValue(uploadMock)
      vi.spyOn(referenceDataService, 'getSchemes').mockResolvedValue([
        { value: 'sfi', label: 'Sustainable Farming Incentive' },
        { value: 'none', label: 'Not scheme-specific' }
      ])

      request = { yar: { get: vi.fn(), flash: vi.fn(() => []) } }

      await getMetadataForm(request, h)

      expect(h.view).toHaveBeenCalledWith(METADATA_VIEW, expect.objectContaining({
        values: expect.objectContaining({ guideTitle: 'Existing Title' }),
        schemeOptions: [
          { value: 'sfi', text: 'Sustainable Farming Incentive' },
          { value: 'none', text: 'Not scheme-specific', divider: 'or' }
        ],
        notification: null
      }))
      expect(code).toHaveBeenCalledWith(statusCodes.HTTP_STATUS_OK)
    })

    test('does not fetch a draft when no fileId is known yet', async () => {
      const uploadMock = {
        hasUpload: vi.fn(() => true),
        activeUploadId: 'test-upload-id',
        fileId: null,
        metadata: {}
      }
      vi.spyOn(session, 'getGuideUpload').mockReturnValue(uploadMock)
      vi.spyOn(referenceDataService, 'getSchemes').mockResolvedValue([])
      const getDraftByIdSpy = vi.spyOn(draftsService, 'getDraftById')

      request = { yar: { get: vi.fn(), flash: vi.fn(() => []) } }

      await getMetadataForm(request, h)

      expect(getDraftByIdSpy).not.toHaveBeenCalled()
    })

    test('loads draft title, version and formatted last modified date into the view model', async () => {
      const uploadMock = {
        hasUpload: vi.fn(() => true),
        activeUploadId: 'test-upload-id',
        fileId: 'file-1',
        metadata: {}
      }
      vi.spyOn(session, 'getGuideUpload').mockReturnValue(uploadMock)
      vi.spyOn(referenceDataService, 'getSchemes').mockResolvedValue([])
      vi.spyOn(draftsService, 'getDraftById').mockResolvedValue({
        fileId: 'file-1',
        title: 'Parsed Title',
        version: '2.0',
        lastModified: '2026-05-10T12:00:00.000Z'
      })

      request = { yar: { get: vi.fn(), flash: vi.fn(() => []) } }

      await getMetadataForm(request, h)

      expect(draftsService.getDraftById).toHaveBeenCalledWith('file-1')
      expect(h.view).toHaveBeenCalledWith(METADATA_VIEW, expect.objectContaining({
        values: expect.objectContaining({ guideTitle: 'Parsed Title' }),
        versionNumber: '2.0',
        lastModifiedDate: '10 May 2026'
      }))
    })

    test('a title already saved to session takes precedence over the parsed draft title', async () => {
      const uploadMock = {
        hasUpload: vi.fn(() => true),
        activeUploadId: 'test-upload-id',
        fileId: 'file-1',
        metadata: { guideTitle: 'User Overwritten Title' }
      }
      vi.spyOn(session, 'getGuideUpload').mockReturnValue(uploadMock)
      vi.spyOn(referenceDataService, 'getSchemes').mockResolvedValue([])
      vi.spyOn(draftsService, 'getDraftById').mockResolvedValue({
        fileId: 'file-1',
        title: 'Parsed Title',
        version: '2.0',
        lastModified: '2026-05-10T12:00:00.000Z'
      })

      request = { yar: { get: vi.fn(), flash: vi.fn(() => []) } }

      await getMetadataForm(request, h)

      expect(h.view).toHaveBeenCalledWith(METADATA_VIEW, expect.objectContaining({
        values: expect.objectContaining({ guideTitle: 'User Overwritten Title' })
      }))
    })

    test('falls back to "Not available" when no draft has been claimed yet for the fileId', async () => {
      const uploadMock = {
        hasUpload: vi.fn(() => true),
        activeUploadId: 'test-upload-id',
        fileId: 'file-1',
        metadata: {}
      }
      vi.spyOn(session, 'getGuideUpload').mockReturnValue(uploadMock)
      vi.spyOn(referenceDataService, 'getSchemes').mockResolvedValue([])
      vi.spyOn(draftsService, 'getDraftById').mockResolvedValue(null)

      request = { yar: { get: vi.fn(), flash: vi.fn(() => []) } }

      await getMetadataForm(request, h)

      expect(h.view).toHaveBeenCalledWith(METADATA_VIEW, expect.objectContaining({
        values: expect.objectContaining({ guideTitle: '' }),
        versionNumber: 'Not available',
        lastModifiedDate: 'Not available'
      }))
    })

    test('renders a flashed upload notification when one is pending', async () => {
      const uploadMock = {
        hasUpload: vi.fn(() => true),
        activeUploadId: 'test-upload-id',
        fileId: null,
        metadata: {}
      }
      vi.spyOn(session, 'getGuideUpload').mockReturnValue(uploadMock)
      vi.spyOn(referenceDataService, 'getSchemes').mockResolvedValue([])

      request = {
        yar: {
          get: vi.fn(),
          flash: vi.fn(() => ['You have already uploaded a document for this guide'])
        }
      }

      await getMetadataForm(request, h)

      expect(request.yar.flash).toHaveBeenCalledWith('uploadNotification')
      expect(h.view).toHaveBeenCalledWith(METADATA_VIEW, expect.objectContaining({
        notification: 'You have already uploaded a document for this guide'
      }))
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

    test('preserves the draft version and formatted last modified date when redisplaying after a validation error', async () => {
      const uploadMock = {
        hasUpload: vi.fn(() => true),
        activeUploadId: 'test-upload-id',
        fileId: 'file-1'
      }
      vi.spyOn(session, 'getGuideUpload').mockReturnValue(uploadMock)
      vi.spyOn(referenceDataService, 'getSchemes').mockResolvedValue([])
      vi.spyOn(draftsService, 'getDraftById').mockResolvedValue({
        fileId: 'file-1',
        title: 'Parsed Title',
        version: '2.0',
        lastModified: '2026-05-10T12:00:00.000Z'
      })

      request = {
        payload: { guideTitle: '' },
        yar: { get: vi.fn() }
      }
      const err = {
        details: [{ path: ['guideTitle'], message: 'Enter the guidance title' }]
      }

      await metadataFailAction(request, h, err)

      expect(draftsService.getDraftById).toHaveBeenCalledWith('file-1')
      expect(h.view).toHaveBeenCalledWith(METADATA_VIEW, expect.objectContaining({
        versionNumber: '2.0',
        lastModifiedDate: '10 May 2026'
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
