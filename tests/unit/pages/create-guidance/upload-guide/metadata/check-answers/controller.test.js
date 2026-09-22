import { statusCodes } from '../../../../../../../src/constants/status-codes.js'
import * as session from '../../../../../../../src/pages/create-guidance/session.js'
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
      yar: { get: vi.fn(() => null) },
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

    test('redirects to the dashboard when the metadata is valid against the current reference options', async () => {
      mockUpload(validMetadata())
      mockReferenceData()

      await convertDocument(request, h)

      expect(h.redirect).toHaveBeenCalledWith('/designer/dashboard')
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
