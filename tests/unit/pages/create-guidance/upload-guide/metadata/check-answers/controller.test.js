import { statusCodes } from '../../../../../../../src/constants/status-codes.js'
import * as session from '../../../../../../../src/pages/create-guidance/session.js'
import * as guidesService from '../../../../../../../src/services/guides.js'
import * as referenceDataService from '../../../../../../../src/services/reference-data.js'
import * as stagedDocumentsService from '../../../../../../../src/services/staged-documents.js'
import {
  convertDocument,
  getCheckAnswers
} from '../../../../../../../src/pages/create-guidance/upload-guide/metadata/check-answers/controller.js'

const CHECK_ANSWERS_VIEW = 'create-guidance/upload-guide/metadata/check-answers/page.njk'

function validMetadata (overrides = {}) {
  return {
    guideTitle: 'A title',
    schemes: ['sfi'],
    owner: 'owner@example.com',
    goal: 'A purpose',
    requirements: 'Training',
    systems: ['crm'],
    audience: ['processor'],
    ...overrides
  }
}

function mockUpload (metadata, fileId = 'file-1') {
  const upload = {
    hasUpload: vi.fn(() => true),
    activeUploadId: 'test-upload-id',
    fileId,
    metadata
  }
  vi.spyOn(session, 'getGuideUpload').mockReturnValue(upload)
  return upload
}

function mockReferenceData () {
  vi.spyOn(referenceDataService, 'getSchemes').mockResolvedValue([{ value: 'sfi', label: 'SFI' }])
  vi.spyOn(referenceDataService, 'getSystems').mockResolvedValue([{ value: 'crm', label: 'CRM' }])
  vi.spyOn(referenceDataService, 'getAudiences').mockResolvedValue([{ value: 'processor', label: 'Processor' }])
}

describe('upload-guide metadata check-answers controller', () => {
  let request, h, code

  beforeEach(() => {
    vi.restoreAllMocks()
    code = vi.fn()
    h = {
      view: vi.fn(() => ({ code })),
      redirect: vi.fn()
    }
    request = {
      yar: { get: vi.fn(() => null), clear: vi.fn(), flash: vi.fn() },
      logger: { error: vi.fn() }
    }
  })

  describe('getCheckAnswers', () => {
    test('redirects to the upload form if there is no active upload', async () => {
      await getCheckAnswers(request, h)

      expect(h.redirect).toHaveBeenCalledWith('/create-guidance/upload-guide')
    })

    test('redirects to the guide details form if its title or schemes are missing', async () => {
      mockUpload({ guideTitle: '' })
      mockReferenceData()

      await getCheckAnswers(request, h)

      expect(h.redirect).toHaveBeenCalledWith('/create-guidance/upload-guide/metadata')
    })

    test('redirects to the purpose form if its answers are missing', async () => {
      mockUpload({ guideTitle: 'A title', schemes: ['sfi'] })
      mockReferenceData()

      await getCheckAnswers(request, h)

      expect(h.redirect).toHaveBeenCalledWith('/create-guidance/upload-guide/metadata/purpose')
    })

    test('renders the summary cards with labelled answers and staged doc info', async () => {
      mockUpload(validMetadata(), 'file-1')
      mockReferenceData()
      vi.spyOn(stagedDocumentsService, 'getStagedDocumentById').mockResolvedValue({
        version: '1.0',
        lastModified: '2026-06-29T10:00:00.000Z'
      })

      await getCheckAnswers(request, h)

      expect(h.view).toHaveBeenCalledWith(CHECK_ANSWERS_VIEW, expect.objectContaining({
        guideDetailsCard: expect.objectContaining({
          title: { text: "The guide's details" }
        }),
        ownerPurposeCard: expect.objectContaining({
          title: { text: 'Owner and purpose' }
        })
      }))
      expect(code).toHaveBeenCalledWith(statusCodes.HTTP_STATUS_OK)
    })
  })

  describe('convertDocument', () => {
    test('redirects to upload if there is no active upload', async () => {
      await convertDocument(request, h)

      expect(h.redirect).toHaveBeenCalledWith('/create-guidance/upload-guide')
    })

    test('re-renders check answers with an error summary when the guide details answers are missing', async () => {
      mockUpload({ guideTitle: '' })
      mockReferenceData()
      vi.spyOn(stagedDocumentsService, 'getStagedDocumentById').mockResolvedValue(null)

      await convertDocument(request, h)

      expect(h.view).toHaveBeenCalledWith(CHECK_ANSWERS_VIEW, expect.objectContaining({
        errorList: expect.arrayContaining([
          expect.objectContaining({ href: '/create-guidance/upload-guide/metadata?from=check' })
        ])
      }))
      expect(code).toHaveBeenCalledWith(statusCodes.HTTP_STATUS_BAD_REQUEST)
    })

    test('re-renders check answers with an error summary when the purpose answers are missing', async () => {
      mockUpload({ guideTitle: 'A title', schemes: ['sfi'] })
      mockReferenceData()
      vi.spyOn(stagedDocumentsService, 'getStagedDocumentById').mockResolvedValue(null)

      await convertDocument(request, h)

      expect(h.view).toHaveBeenCalledWith(CHECK_ANSWERS_VIEW, expect.objectContaining({
        errorList: expect.arrayContaining([
          expect.objectContaining({ href: '/create-guidance/upload-guide/metadata/purpose?from=check' })
        ])
      }))
      expect(code).toHaveBeenCalledWith(statusCodes.HTTP_STATUS_BAD_REQUEST)
    })

    test('creates the guide from the upload, its answers and the signed-in user, then confirms it', async () => {
      mockUpload(validMetadata())
      mockReferenceData()
      const createGuideSpy = vi.spyOn(guidesService, 'createGuide')
        .mockResolvedValue({ code: guidesService.RESULTS.GUIDE_CREATED })
      request.auth = { credentials: { profile: { id: 'user-1', displayName: 'A User' } } }

      await convertDocument(request, h)

      expect(createGuideSpy).toHaveBeenCalledWith({
        uploadId: 'test-upload-id',
        fileId: 'file-1',
        metadata: validMetadata(),
        user: { id: 'user-1', displayName: 'A User' }
      })
      expect(h.redirect).toHaveBeenCalledWith('/create-guidance/upload-guide/converted')
    })

    test('carries the guide title over to the confirmation', async () => {
      mockUpload(validMetadata())
      mockReferenceData()
      vi.spyOn(guidesService, 'createGuide')
        .mockResolvedValue({ code: guidesService.RESULTS.GUIDE_CREATED })
      const flashSpy = vi.spyOn(session, 'flashConvertedGuide').mockReturnValue()
      request.auth = { credentials: { profile: { id: 'user-1', displayName: 'A User' } } }

      await convertDocument(request, h)

      expect(flashSpy).toHaveBeenCalledWith(request, validMetadata().guideTitle)
    })

    test('clears the upload from the session once the guide is created, so the next guide starts afresh', async () => {
      mockUpload(validMetadata())
      mockReferenceData()
      vi.spyOn(guidesService, 'createGuide')
        .mockResolvedValue({ code: guidesService.RESULTS.GUIDE_CREATED })
      const clearSpy = vi.spyOn(session, 'clearGuideUpload').mockReturnValue()
      request.auth = { credentials: { profile: { id: 'user-1', displayName: 'A User' } } }

      await convertDocument(request, h)

      expect(clearSpy).toHaveBeenCalledWith(request)
    })

    test.each([
      'UPLOAD_EXPIRED',
      'PARSE_PENDING',
      'PARSE_FAILED'
    ])('keeps the upload in the session when the result is %s', async (result) => {
      mockUpload(validMetadata())
      mockReferenceData()
      vi.spyOn(stagedDocumentsService, 'getStagedDocumentById').mockResolvedValue(null)
      vi.spyOn(guidesService, 'createGuide')
        .mockResolvedValue({ code: guidesService.RESULTS[result] })
      const clearSpy = vi.spyOn(session, 'clearGuideUpload').mockReturnValue()
      request.auth = { credentials: { profile: { id: 'user-1', displayName: 'A User' } } }

      await convertDocument(request, h)

      expect(clearSpy).not.toHaveBeenCalled()
    })

    test.each([
      ['its upload has expired', 'UPLOAD_EXPIRED', 'The uploaded document has expired. Start again and upload it again'],
      ['its parse is unfinished', 'PARSE_PENDING', 'The uploaded document is still being processed. Wait a few seconds, then select Convert document again'],
      ['its parse failed', 'PARSE_FAILED', 'The uploaded document cannot be opened. Check you selected the correct file and that it has not been corrupted, then start over and upload it again. If this keeps happening, contact the support team']
    ])('explains why the document cannot be converted when %s', async (_, result, message) => {
      mockUpload(validMetadata())
      mockReferenceData()
      vi.spyOn(stagedDocumentsService, 'getStagedDocumentById').mockResolvedValue(null)
      vi.spyOn(guidesService, 'createGuide')
        .mockResolvedValue({ code: guidesService.RESULTS[result] })
      request.auth = { credentials: { profile: { id: 'user-1', displayName: 'A User' } } }

      await convertDocument(request, h)

      expect(h.view).toHaveBeenCalledWith(CHECK_ANSWERS_VIEW, expect.objectContaining({
        errorList: [{ text: message, href: '#conversion-error' }]
      }))
      expect(code).toHaveBeenCalledWith(statusCodes.HTTP_STATUS_BAD_REQUEST)
      expect(h.redirect).not.toHaveBeenCalled()
    })

    test('does not create the guide when an answer is missing', async () => {
      mockUpload({ guideTitle: '' })
      mockReferenceData()
      vi.spyOn(stagedDocumentsService, 'getStagedDocumentById').mockResolvedValue(null)
      const createGuideSpy = vi.spyOn(guidesService, 'createGuide')

      await convertDocument(request, h)

      expect(createGuideSpy).not.toHaveBeenCalled()
    })

    test('re-renders check answers with an error summary when a previously valid option is no longer current', async () => {
      mockUpload(validMetadata({ schemes: ['retired-scheme'] }), 'file-1')
      mockReferenceData()
      vi.spyOn(stagedDocumentsService, 'getStagedDocumentById').mockResolvedValue(null)

      await convertDocument(request, h)

      expect(h.view).toHaveBeenCalledWith(CHECK_ANSWERS_VIEW, expect.objectContaining({
        errorList: expect.arrayContaining([
          expect.objectContaining({
            text: 'Select at least one scheme this guidance relates to',
            href: '/create-guidance/upload-guide/metadata?from=check'
          })
        ])
      }))
      expect(code).toHaveBeenCalledWith(statusCodes.HTTP_STATUS_BAD_REQUEST)
    })
  })
})
