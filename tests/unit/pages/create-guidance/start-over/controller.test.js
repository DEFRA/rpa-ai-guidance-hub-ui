import { statusCodes } from '../../../../../src/constants/status-codes.js'
import * as referenceDataService from '../../../../../src/services/reference-data.js'
import * as stagedDocumentsService from '../../../../../src/services/staged-documents.js'
import { getStartOver, postStartOver } from '../../../../../src/pages/create-guidance/start-over/controller.js'

const START_OVER_VIEW = 'create-guidance/start-over/page.njk'
const UPLOAD_GUIDE_URL = '/create-guidance/upload-guide'
const METADATA_URL = '/create-guidance/upload-guide/metadata'

function requestWith (sessionData, query = {}) {
  return {
    yar: {
      get: vi.fn(() => sessionData),
      clear: vi.fn()
    },
    query
  }
}

function mockReferenceData () {
  vi.spyOn(referenceDataService, 'getSchemes').mockResolvedValue([{ value: 'sfi', label: 'SFI' }])
  vi.spyOn(referenceDataService, 'getSystems').mockResolvedValue([{ value: 'crm', label: 'CRM' }])
  vi.spyOn(referenceDataService, 'getAudiences').mockResolvedValue([{ value: 'processor', label: 'Processor' }])
}

describe('start-over controller', () => {
  let h, code

  beforeEach(() => {
    vi.restoreAllMocks()
    code = vi.fn()
    h = {
      view: vi.fn(() => ({ code })),
      redirect: vi.fn()
    }
  })

  describe('getStartOver', () => {
    test('clears session and redirects immediately when there is no upload', async () => {
      const request = requestWith(null)

      await getStartOver(request, h)

      expect(request.yar.clear).toHaveBeenCalledWith('guide-upload')
      expect(h.redirect).toHaveBeenCalledWith(UPLOAD_GUIDE_URL)
      expect(h.view).not.toHaveBeenCalled()
    })

    test('clears session and redirects immediately when the upload has failed', async () => {
      const request = requestWith({ uploads: [{ uploadId: 'u-1', completedStepIds: [] }] })

      await getStartOver(request, h)

      expect(request.yar.clear).toHaveBeenCalledWith('guide-upload')
      expect(h.redirect).toHaveBeenCalledWith(UPLOAD_GUIDE_URL)
    })

    test('shows what would be discarded, including the uploaded file, instead of resetting when metadata has been captured', async () => {
      mockReferenceData()
      vi.spyOn(stagedDocumentsService, 'getStagedDocumentById').mockResolvedValue({
        fileId: 'file-1',
        version: '1.2',
        lastModified: '2024-01-01T00:00:00.000Z'
      })

      const request = requestWith({
        uploads: [{
          uploadId: 'u-1',
          completedStepIds: ['scanning', 'parse'],
          fileId: 'file-1',
          metadata: { guideTitle: 'Test', schemes: ['sfi'], owner: 'owner@example.com' }
        }]
      })

      await getStartOver(request, h)

      expect(stagedDocumentsService.getStagedDocumentById).toHaveBeenCalledWith('file-1')
      expect(request.yar.clear).not.toHaveBeenCalled()
      expect(h.redirect).not.toHaveBeenCalled()
      expect(h.view).toHaveBeenCalledWith(
        START_OVER_VIEW,
        expect.objectContaining({
          cancelUrl: METADATA_URL,
          guideDetailsCard: expect.objectContaining({
            rows: expect.arrayContaining([
              expect.objectContaining({ key: { text: 'Guidance title' }, value: { text: 'Test' } }),
              expect.objectContaining({ key: { text: 'Version number' }, value: { text: '1.2' } })
            ])
          }),
          ownerPurposeCard: expect.objectContaining({
            rows: expect.arrayContaining([
              expect.objectContaining({ key: { text: 'Owner email' }, value: { text: 'owner@example.com' } })
            ])
          })
        })
      )
      expect(code).toHaveBeenCalledWith(statusCodes.HTTP_STATUS_OK)
    })

    test('asks for confirmation once the upload has completed, even without metadata yet', async () => {
      mockReferenceData()
      vi.spyOn(stagedDocumentsService, 'getStagedDocumentById').mockResolvedValue(null)

      const request = requestWith({
        uploads: [{ uploadId: 'u-1', completedStepIds: ['scanning', 'parse'], fileId: 'file-1' }]
      })

      await getStartOver(request, h)

      expect(request.yar.clear).not.toHaveBeenCalled()
      expect(h.view).toHaveBeenCalledWith(
        START_OVER_VIEW,
        expect.objectContaining({
          guideDetailsCard: expect.objectContaining({
            rows: expect.arrayContaining([
              expect.objectContaining({ key: { text: 'Guidance title' }, value: { text: 'Not provided' } })
            ])
          })
        })
      )
    })

    test('uses returnUrl as the cancel target when it is within the journey', async () => {
      mockReferenceData()
      vi.spyOn(stagedDocumentsService, 'getStagedDocumentById').mockResolvedValue(null)

      const request = requestWith(
        { uploads: [{ uploadId: 'u-1', completedStepIds: [], metadata: { guideTitle: 'Test' } }] },
        { returnUrl: '/create-guidance/upload-guide/metadata/purpose' }
      )

      await getStartOver(request, h)

      expect(h.view).toHaveBeenCalledWith(
        START_OVER_VIEW,
        expect.objectContaining({ cancelUrl: '/create-guidance/upload-guide/metadata/purpose' })
      )
    })

    test('falls back to the default cancel url when returnUrl points outside the journey', async () => {
      mockReferenceData()
      vi.spyOn(stagedDocumentsService, 'getStagedDocumentById').mockResolvedValue(null)

      const request = requestWith(
        { uploads: [{ uploadId: 'u-1', completedStepIds: [], metadata: { guideTitle: 'Test' } }] },
        { returnUrl: '//evil.example.com' }
      )

      await getStartOver(request, h)

      expect(h.view).toHaveBeenCalledWith(
        START_OVER_VIEW,
        expect.objectContaining({ cancelUrl: METADATA_URL })
      )
    })
  })

  describe('postStartOver', () => {
    test('clears session and redirects to the upload form', () => {
      const request = requestWith(null)

      postStartOver(request, h)

      expect(request.yar.clear).toHaveBeenCalledWith('guide-upload')
      expect(h.redirect).toHaveBeenCalledWith(UPLOAD_GUIDE_URL)
    })
  })
})
