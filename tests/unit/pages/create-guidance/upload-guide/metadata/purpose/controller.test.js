import { statusCodes } from '../../../../../../../src/constants/status-codes.js'
import * as session from '../../../../../../../src/pages/create-guidance/session.js'
import * as referenceDataService from '../../../../../../../src/services/reference-data.js'
import {
  getPurposeOptions,
  getPurposeForm,
  purposeFailAction,
  savePurpose
} from '../../../../../../../src/pages/create-guidance/upload-guide/metadata/purpose/controller.js'

vi.mock('../../../../../../../src/services/reference-data.js', async (importOriginal) => ({
  ...await importOriginal(),
  getSchemes: vi.fn(),
  getSystems: vi.fn(),
  getAudiences: vi.fn()
}))
vi.mock('../../../../../../../src/pages/create-guidance/session.js')

const PURPOSE_VIEW = 'create-guidance/upload-guide/metadata/purpose/page.njk'
const systemOptions = [{ label: 'CRM', shortLabel: 'CRM' }]
const audienceOptions = [{ label: 'Processor', shortLabel: 'Processor' }]

function mockReferenceData () {
  referenceDataService.getSystems.mockResolvedValue(systemOptions)
  referenceDataService.getAudiences.mockResolvedValue(audienceOptions)
}

function mockUpload (metadata) {
  const upload = { hasUpload: vi.fn(() => true), activeUploadId: 'test-upload-id', metadata }
  session.getGuideUpload.mockReturnValue(upload)
  return upload
}

describe('upload-guide metadata purpose controller', () => {
  let request, h, code, takeover

  beforeEach(() => {
    vi.resetAllMocks()
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

    test('redirects to the guide details form if its answers are missing', async () => {
      mockUpload(null)

      await getPurposeForm(request, h)

      expect(h.redirect).toHaveBeenCalledWith('/create-guidance/upload-guide/metadata')
    })

    test('renders the form with saved values and both option lists', async () => {
      mockUpload({ guideTitle: 'A title', owner: 'owner@example.com', systems: ['CRM'] })
      mockReferenceData()

      await getPurposeForm(request, h)

      expect(h.view).toHaveBeenCalledWith(PURPOSE_VIEW, expect.objectContaining({
        values: expect.objectContaining({ owner: 'owner@example.com', systems: ['CRM'], audience: [] }),
        systemOptions: [{ value: 'CRM', text: 'CRM' }],
        audienceOptions: [{ value: 'Processor', text: 'Processor' }]
      }))
      expect(code).toHaveBeenCalledWith(statusCodes.HTTP_STATUS_OK)
    })

    test('sets backUrl and formAction with from=check when changing from check-answers', async () => {
      mockUpload({ guideTitle: 'A title' })
      mockReferenceData()
      request.query = { from: 'check' }

      await getPurposeForm(request, h)

      expect(h.view).toHaveBeenCalledWith(
        PURPOSE_VIEW,
        expect.objectContaining({
          backUrl: '/create-guidance/upload-guide/metadata/check-answers',
          formAction: '/create-guidance/upload-guide/metadata/purpose?from=check'
        })
      )
    })
  })

  describe('purposeFailAction', () => {
    test('re-renders with 400, the validation errors and normalized selections', async () => {
      mockReferenceData()
      request.payload = { owner: '', systems: 'CRM' }
      const err = { details: [{ path: ['owner'], message: 'Enter an email address' }] }

      await purposeFailAction(request, h, err)

      expect(h.view).toHaveBeenCalledWith(PURPOSE_VIEW, expect.objectContaining({
        errors: { owner: 'Enter an email address' },
        errorList: [{ text: 'Enter an email address', href: '#owner' }],
        values: { owner: '', systems: ['CRM'], audience: [] },
        systemOptions: [{ value: 'CRM', text: 'CRM' }]
      }))
      expect(code).toHaveBeenCalledWith(statusCodes.HTTP_STATUS_BAD_REQUEST)
      expect(takeover).toHaveBeenCalled()
    })

    test('sets backUrl and formAction with from=check when validation fails from check-answers', async () => {
      mockReferenceData()
      request.query = { from: 'check' }
      request.payload = { owner: '', systems: 'CRM' }
      const err = { details: [{ path: ['owner'], message: 'Enter an email address' }] }

      await purposeFailAction(request, h, err)

      expect(h.view).toHaveBeenCalledWith(
        PURPOSE_VIEW,
        expect.objectContaining({
          backUrl: '/create-guidance/upload-guide/metadata/check-answers',
          formAction: '/create-guidance/upload-guide/metadata/purpose?from=check'
        })
      )
    })
  })

  describe('savePurpose', () => {
    test('redirects to the upload form if there is no active upload', async () => {
      await savePurpose(request, h)

      expect(h.redirect).toHaveBeenCalledWith('/create-guidance/upload-guide')
    })

    test('redirects to the guide details form if its answers are missing', async () => {
      mockUpload({})

      await savePurpose(request, h)

      expect(h.redirect).toHaveBeenCalledWith('/create-guidance/upload-guide/metadata')
    })

    test('merges the answers into session and redirects to check answers', async () => {
      mockUpload({ guideTitle: 'A title' })
      session.setGuideUploadMetadata.mockImplementation(() => {})
      request.payload = {
        owner: 'owner@example.com',
        goal: 'A purpose',
        requirements: 'Training',
        systems: 'CRM',
        audience: ['Processor', 'Team-leader'],
        extra: 'ignored'
      }

      await savePurpose(request, h)

      expect(session.setGuideUploadMetadata).toHaveBeenCalledWith(request, {
        owner: 'owner@example.com',
        goal: 'A purpose',
        requirements: 'Training',
        systems: ['CRM'],
        audience: ['Processor', 'Team-leader']
      })
      expect(h.redirect).toHaveBeenCalledWith('/create-guidance/upload-guide/metadata/check-answers')
    })

    test('redirects to check answers even when from=check query is provided', async () => {
      mockUpload({ guideTitle: 'A title' })
      session.setGuideUploadMetadata.mockImplementation(() => {})
      request.query = { from: 'check' }
      request.payload = {
        owner: 'owner@example.com',
        goal: 'A purpose',
        requirements: 'Training',
        systems: ['CRM'],
        audience: ['Processor']
      }

      await savePurpose(request, h)

      expect(h.redirect).toHaveBeenCalledWith(
        '/create-guidance/upload-guide/metadata/check-answers'
      )
    })
  })
})
