import { statusCodes } from '../../../../../../../src/constants/status-codes.js'
import * as session from '../../../../../../../src/pages/create-guidance/session.js'
import * as referenceDataService from '../../../../../../../src/services/reference-data.js'
import {
  getPurposeOptions,
  getPurposeForm,
  purposeFailAction,
  savePurpose
} from '../../../../../../../src/pages/create-guidance/upload-guide/metadata/purpose/controller.js'

const PURPOSE_VIEW = 'create-guidance/upload-guide/metadata/purpose/page.njk'
const systemOptions = [{ value: 'crm', label: 'CRM' }]
const audienceOptions = [{ value: 'processor', label: 'Processor' }]

function mockReferenceData () {
  vi.spyOn(referenceDataService, 'getSystems').mockResolvedValue(systemOptions)
  vi.spyOn(referenceDataService, 'getAudiences').mockResolvedValue(audienceOptions)
}

function mockUpload (metadata) {
  const upload = { hasUpload: vi.fn(() => true), activeUploadId: 'test-upload-id', metadata }
  vi.spyOn(session, 'getGuideUpload').mockReturnValue(upload)
  return upload
}

describe('upload-guide metadata purpose controller', () => {
  let request, h, code, takeover

  beforeEach(() => {
    vi.restoreAllMocks()
    takeover = vi.fn()
    code = vi.fn(() => ({ takeover }))
    h = {
      view: vi.fn(() => ({ code })),
      redirect: vi.fn()
    }
    request = { yar: { get: vi.fn(() => null) }, payload: {} }
  })

  describe('getPurposeOptions', () => {
    test('fetches systems and audiences together', async () => {
      mockReferenceData()

      await expect(getPurposeOptions()).resolves.toEqual({ systemOptions, audienceOptions })
    })
  })

  describe('getPurposeForm', () => {
    test('redirects to the upload form if there is no active upload', async () => {
      await getPurposeForm(request, h)

      expect(h.redirect).toHaveBeenCalledWith('/create-guidance/upload-guide')
      expect(h.view).not.toHaveBeenCalled()
    })

    test('redirects to screen 1 if its answers are missing', async () => {
      mockUpload(null)

      await getPurposeForm(request, h)

      expect(h.redirect).toHaveBeenCalledWith('/create-guidance/upload-guide/metadata')
    })

    test('renders the form with saved values and both option lists', async () => {
      mockUpload({ guideTitle: 'A title', owner: 'owner@example.com', systems: ['crm'] })
      mockReferenceData()

      await getPurposeForm(request, h)

      expect(h.view).toHaveBeenCalledWith(PURPOSE_VIEW, expect.objectContaining({
        values: expect.objectContaining({ owner: 'owner@example.com', systems: ['crm'], audience: [] }),
        systemOptions: [{ value: 'crm', text: 'CRM' }],
        audienceOptions: [{ value: 'processor', text: 'Processor' }]
      }))
      expect(code).toHaveBeenCalledWith(statusCodes.HTTP_STATUS_OK)
    })
  })

  describe('purposeFailAction', () => {
    test('re-renders with 400, the validation errors and normalized selections', async () => {
      mockReferenceData()
      request.payload = { owner: '', systems: 'crm' }
      const err = { details: [{ path: ['owner'], message: 'Enter an email address' }] }

      await purposeFailAction(request, h, err)

      expect(h.view).toHaveBeenCalledWith(PURPOSE_VIEW, expect.objectContaining({
        errors: { owner: 'Enter an email address' },
        errorList: [{ text: 'Enter an email address', href: '#owner' }],
        values: { owner: '', systems: ['crm'], audience: [] },
        systemOptions: [{ value: 'crm', text: 'CRM' }]
      }))
      expect(code).toHaveBeenCalledWith(statusCodes.HTTP_STATUS_BAD_REQUEST)
      expect(takeover).toHaveBeenCalled()
    })
  })

  describe('savePurpose', () => {
    test('redirects to the upload form if there is no active upload', async () => {
      await savePurpose(request, h)

      expect(h.redirect).toHaveBeenCalledWith('/create-guidance/upload-guide')
    })

    test('redirects to screen 1 if its answers are missing', async () => {
      mockUpload({})

      await savePurpose(request, h)

      expect(h.redirect).toHaveBeenCalledWith('/create-guidance/upload-guide/metadata')
    })

    test('merges the answers into session and redirects to check answers', async () => {
      mockUpload({ guideTitle: 'A title' })
      const setMetadataSpy = vi.spyOn(session, 'setGuideUploadMetadata').mockImplementation(() => {})
      request.payload = {
        owner: 'owner@example.com',
        goal: 'A purpose',
        requirements: 'Training',
        systems: 'crm',
        audience: ['processor', 'team-leader'],
        extra: 'ignored'
      }

      await savePurpose(request, h)

      expect(setMetadataSpy).toHaveBeenCalledWith(request, {
        owner: 'owner@example.com',
        goal: 'A purpose',
        requirements: 'Training',
        systems: ['crm'],
        audience: ['processor', 'team-leader']
      })
      expect(h.redirect).toHaveBeenCalledWith('/create-guidance/upload-guide/metadata/check-answers')
    })
  })
})
