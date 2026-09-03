import { statusCodes } from '../../../../../src/constants/status-codes.js'

vi.mock('../../../../../src/pages/create-guidance/session.js', () => ({
  getGuideUpload: vi.fn(),
  createGuideUpload: vi.fn(),
  addGuideUpload: vi.fn()
}))

vi.mock('../../../../../src/pages/create-guidance/service.js', () => ({
  startMigration: vi.fn()
}))

vi.mock('../../../../../src/pages/create-guidance/action-type/view-models.js', () => ({
  // a real function, not an arrow, so it stays usable as a constructor
  ActionTypeViewModel: vi.fn().mockImplementation(function () { return { page: 'action chooser' } })
}))

import { getGuideUpload, createGuideUpload, addGuideUpload } from '../../../../../src/pages/create-guidance/session.js'
import { startMigration } from '../../../../../src/pages/create-guidance/service.js'
import { getActionForm, postAction } from '../../../../../src/pages/create-guidance/action-type/controller.js'

const ACTION_TYPE_VIEW = 'create-guidance/action-type/page.njk'

describe('action-type controller', () => {
  let h, code

  beforeEach(() => {
    code = vi.fn()
    h = {
      view: vi.fn(() => ({ code })),
      redirect: vi.fn(() => ({ redirected: true }))
    }
  })

  describe('getActionForm', () => {
    test('renders the action chooser view model', async () => {
      await getActionForm({}, h)

      expect(h.view).toHaveBeenCalledWith(ACTION_TYPE_VIEW, { page: 'action chooser' })
    })

    test('responds with 200', async () => {
      await getActionForm({}, h)

      expect(code).toHaveBeenCalledWith(statusCodes.HTTP_STATUS_OK)
    })
  })

  describe('postAction', () => {
    test('redirects to the designer dashboard when no action is selected', async () => {
      const result = await postAction({ payload: {} }, h)

      expect(h.redirect).toHaveBeenCalledWith('/designer/dashboard')
      expect(result).toEqual(h.redirect())
    })

    describe('when migrate is selected and no upload exists yet', () => {
      let request

      beforeEach(() => {
        request = { payload: { action: 'migrate' }, yar: { get: vi.fn(), set: vi.fn(), flash: vi.fn() } }

        getGuideUpload.mockReturnValue(null)
        createGuideUpload.mockReturnValue({ hasUpload: () => false })
        startMigration.mockResolvedValue({ code: 'migrationStarted', uploadId: 'abc-123' })
      })

      test('creates a new upload wrapper in session', async () => {
        await postAction(request, h)

        expect(createGuideUpload).toHaveBeenCalledWith(request)
      })

      test('stores the started upload id against the session', async () => {
        await postAction(request, h)

        expect(addGuideUpload).toHaveBeenCalledWith(request, 'abc-123')
      })

      test('redirects to upload-guide', async () => {
        const result = await postAction(request, h)

        expect(h.redirect).toHaveBeenCalledWith('/create-guidance/upload-guide')
        expect(result).toEqual(h.redirect())
      })
    })

    describe('when migrate is selected and the existing upload has already been used', () => {
      let request

      beforeEach(() => {
        request = { payload: { action: 'migrate' }, yar: { get: vi.fn(), set: vi.fn(), flash: vi.fn() } }

        getGuideUpload.mockReturnValue({ hasUpload: () => true, activeUploadId: 'u-1' })
        startMigration.mockResolvedValue({ code: 'uploadExpended' })
      })

      test('redirects to add-metadata rather than starting a new upload', async () => {
        const result = await postAction(request, h)

        expect(h.redirect).toHaveBeenCalledWith('/create-guidance/add-metadata')
        expect(result).toEqual(h.redirect())
        expect(addGuideUpload).not.toHaveBeenCalled()
      })
    })
  })
})
