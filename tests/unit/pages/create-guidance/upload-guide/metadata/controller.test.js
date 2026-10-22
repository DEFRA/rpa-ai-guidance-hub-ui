import { statusCodes } from '../../../../../../src/constants/status-codes.js'
import * as referenceDataService from '../../../../../../src/services/reference-data.js'
import * as session from '../../../../../../src/pages/create-guidance/session.js'
import * as stagedDocumentsService from '../../../../../../src/services/staged-documents.js'
import {
  getMetadataForm,
  metadataFailAction,
  saveMetadata
} from '../../../../../../src/pages/create-guidance/upload-guide/metadata/controller.js'

vi.mock('../../../../../../src/services/reference-data.js', async (importOriginal) => ({
  ...await importOriginal(),
  getSchemes: vi.fn(),
  getSystems: vi.fn(),
  getAudiences: vi.fn()
}))
vi.mock('../../../../../../src/pages/create-guidance/session.js')
vi.mock('../../../../../../src/services/staged-documents.js')

const METADATA_VIEW = 'create-guidance/upload-guide/metadata/page.njk'

describe('upload-guide metadata controller', () => {
  let request, h, code, redirect, takeover

  beforeEach(() => {
    vi.resetAllMocks()
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
      session.getGuideUpload.mockReturnValue(uploadMock)
      referenceDataService.getSchemes.mockResolvedValue([
        { label: 'Sustainable Farming Incentive', shortLabel: 'Sustainable Farming Incentive' },
        { label: 'Not scheme-specific', shortLabel: 'Not scheme-specific' }
      ])

      request = { yar: { get: vi.fn(), flash: vi.fn(() => []) } }

      await getMetadataForm(request, h)

      expect(h.view).toHaveBeenCalledWith(METADATA_VIEW, expect.objectContaining({
        values: expect.objectContaining({ guideTitle: 'Existing Title' }),
        schemeOptions: [
          { value: 'Sustainable Farming Incentive', text: 'Sustainable Farming Incentive' },
          { value: 'Not scheme-specific', text: 'Not scheme-specific', divider: 'or' }
        ],
        notification: null
      }))
      expect(code).toHaveBeenCalledWith(statusCodes.HTTP_STATUS_OK)
    })

    test('does not fetch a staged document when no fileId is known yet', async () => {
      const uploadMock = {
        hasUpload: vi.fn(() => true),
        activeUploadId: 'test-upload-id',
        fileId: null,
        metadata: {}
      }
      session.getGuideUpload.mockReturnValue(uploadMock)
      referenceDataService.getSchemes.mockResolvedValue([])
      request = { yar: { get: vi.fn(), flash: vi.fn(() => []) } }

      await getMetadataForm(request, h)

      expect(stagedDocumentsService.getStagedDocumentById).not.toHaveBeenCalled()
    })

    test('loads staged document title, version and formatted last modified date into the view model', async () => {
      const uploadMock = {
        hasUpload: vi.fn(() => true),
        activeUploadId: 'test-upload-id',
        fileId: 'file-1',
        metadata: {}
      }
      session.getGuideUpload.mockReturnValue(uploadMock)
      referenceDataService.getSchemes.mockResolvedValue([])
      stagedDocumentsService.getStagedDocumentById
        .mockResolvedValue({
          fileId: 'file-1',
          title: 'Parsed Title',
          version: '2.0',
          lastModified: '2026-05-10T12:00:00.000Z'
        })

      request = { yar: { get: vi.fn(), flash: vi.fn(() => []) } }

      await getMetadataForm(request, h)

      expect(stagedDocumentsService.getStagedDocumentById)
        .toHaveBeenCalledWith('file-1')
      expect(h.view).toHaveBeenCalledWith(METADATA_VIEW, expect.objectContaining({
        values: expect.objectContaining({ guideTitle: 'Parsed Title' }),
        versionNumber: '2.0',
        lastModifiedDate: '10 May 2026'
      }))
    })

    test('sets backUrl and formAction with from=check when changing from check-answers', async () => {
      const uploadMock = {
        hasUpload: vi.fn(() => true),
        activeUploadId: 'test-upload-id',
        fileId: null,
        metadata: {}
      }
      session.getGuideUpload.mockReturnValue(uploadMock)
      referenceDataService.getSchemes.mockResolvedValue([])

      request = {
        query: { from: 'check' },
        yar: { get: vi.fn(), flash: vi.fn(() => []) }
      }

      await getMetadataForm(request, h)

      expect(h.view).toHaveBeenCalledWith(
        METADATA_VIEW,
        expect.objectContaining({
          backUrl: '/create-guidance/upload-guide/metadata/check-answers',
          formAction: '/create-guidance/upload-guide/metadata?from=check'
        })
      )
    })

    test('a title already saved to session takes precedence over the parsed staged document title', async () => {
      const uploadMock = {
        hasUpload: vi.fn(() => true),
        activeUploadId: 'test-upload-id',
        fileId: 'file-1',
        metadata: { guideTitle: 'User Overwritten Title' }
      }
      session.getGuideUpload.mockReturnValue(uploadMock)
      referenceDataService.getSchemes.mockResolvedValue([])
      stagedDocumentsService.getStagedDocumentById
        .mockResolvedValue({
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

    test('falls back to "Not available" when no staged document has been claimed yet for the fileId', async () => {
      const uploadMock = {
        hasUpload: vi.fn(() => true),
        activeUploadId: 'test-upload-id',
        fileId: 'file-1',
        metadata: {}
      }
      session.getGuideUpload.mockReturnValue(uploadMock)
      referenceDataService.getSchemes.mockResolvedValue([])
      stagedDocumentsService.getStagedDocumentById
        .mockResolvedValue(null)

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
      session.getGuideUpload.mockReturnValue(uploadMock)
      referenceDataService.getSchemes.mockResolvedValue([])

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
      referenceDataService.getSchemes.mockResolvedValue([
        { label: 'Not scheme-specific', shortLabel: 'Not scheme-specific' }
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
          { value: 'Not scheme-specific', text: 'Not scheme-specific', divider: 'or' }
        ]
      }))
      expect(code).toHaveBeenCalledWith(statusCodes.HTTP_STATUS_BAD_REQUEST)
      expect(takeover).toHaveBeenCalled()
    })

    test('redisplays a normalized scheme selection when "Not scheme-specific" is submitted alongside another scheme', async () => {
      referenceDataService.getSchemes.mockResolvedValue([])

      request = {
        payload: { guideTitle: '', schemes: ['Not scheme-specific', 'Sustainable Farming Incentive'] },
        yar: { get: vi.fn() }
      }
      const err = {
        details: [{ path: ['guideTitle'], message: 'Enter the guidance title' }]
      }

      await metadataFailAction(request, h, err)

      expect(h.view).toHaveBeenCalledWith(METADATA_VIEW, expect.objectContaining({
        values: expect.objectContaining({ schemes: ['Sustainable Farming Incentive'] })
      }))
    })

    test('preserves the staged document version and formatted last modified date when redisplaying after a validation error', async () => {
      const uploadMock = {
        hasUpload: vi.fn(() => true),
        activeUploadId: 'test-upload-id',
        fileId: 'file-1'
      }
      session.getGuideUpload.mockReturnValue(uploadMock)
      referenceDataService.getSchemes.mockResolvedValue([])
      stagedDocumentsService.getStagedDocumentById
        .mockResolvedValue({
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

      expect(stagedDocumentsService.getStagedDocumentById)
        .toHaveBeenCalledWith('file-1')
      expect(h.view).toHaveBeenCalledWith(METADATA_VIEW, expect.objectContaining({
        versionNumber: '2.0',
        lastModifiedDate: '10 May 2026'
      }))
    })

    test('sets backUrl and formAction with from=check when changing from check-answers', async () => {
      const uploadMock = {
        hasUpload: vi.fn(() => true),
        activeUploadId: 'test-upload-id',
        fileId: null,
        metadata: {}
      }
      session.getGuideUpload.mockReturnValue(uploadMock)
      referenceDataService.getSchemes.mockResolvedValue([])

      request = {
        query: { from: 'check' },
        payload: { guideTitle: '' },
        yar: { get: vi.fn() }
      }
      const err = {
        details: [{ path: ['guideTitle'], message: 'Enter the guidance title' }]
      }

      await metadataFailAction(request, h, err)

      expect(h.view).toHaveBeenCalledWith(
        METADATA_VIEW,
        expect.objectContaining({
          backUrl: '/create-guidance/upload-guide/metadata/check-answers',
          formAction: '/create-guidance/upload-guide/metadata?from=check'
        })
      )
    })
  })

  describe('saveMetadata', () => {
    test('redirects to upload form if no active upload in session', async () => {
      session.getGuideUpload.mockReturnValue(null)

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
      session.getGuideUpload.mockReturnValue(uploadMock)
      session.setGuideUploadMetadata.mockImplementation(() => {})

      request = {
        payload: {
          guideTitle: 'Updated Guide Title',
          schemes: ['sfi']
        },
        yar: { get: vi.fn(), set: vi.fn() }
      }

      await saveMetadata(request, h)

      expect(session.setGuideUploadMetadata).toHaveBeenCalledWith(request, {
        guideTitle: 'Updated Guide Title',
        schemes: ['sfi']
      })
      expect(h.redirect).toHaveBeenCalledWith('/create-guidance/upload-guide/metadata/purpose')
    })

    test('normalizes "Not scheme-specific" out when submitted alongside another scheme', async () => {
      const uploadMock = {
        hasUpload: vi.fn(() => true),
        activeUploadId: 'test-upload-id'
      }
      session.getGuideUpload.mockReturnValue(uploadMock)
      session.setGuideUploadMetadata.mockImplementation(() => {})

      request = {
        payload: {
          guideTitle: 'Updated Guide Title',
          schemes: ['Not scheme-specific', 'Sustainable Farming Incentive']
        },
        yar: { get: vi.fn(), set: vi.fn() }
      }

      await saveMetadata(request, h)

      expect(session.setGuideUploadMetadata).toHaveBeenCalledWith(request, {
        guideTitle: 'Updated Guide Title',
        schemes: ['Sustainable Farming Incentive']
      })
    })

    test('redirects to check-answers when from=check is present', async () => {
      const uploadMock = {
        hasUpload: vi.fn(() => true),
        activeUploadId: 'test-upload-id'
      }
      session.getGuideUpload.mockReturnValue(uploadMock)
      session.setGuideUploadMetadata.mockImplementation(() => {})

      request = {
        query: { from: 'check' },
        payload: {
          guideTitle: 'Updated Guide Title',
          schemes: ['Sustainable Farming Incentive']
        },
        yar: { get: vi.fn(), set: vi.fn() }
      }

      await saveMetadata(request, h)

      expect(h.redirect).toHaveBeenCalledWith(
        '/create-guidance/upload-guide/metadata/check-answers'
      )
    })
  })
})
