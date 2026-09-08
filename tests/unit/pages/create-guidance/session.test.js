import { vi, describe, test, expect, beforeEach } from 'vitest'

import {
  getGuideUpload,
  createGuideUpload,
  addGuideUpload,
  setGuideUploadCompletedSteps
} from '../../../../src/pages/create-guidance/session.js'

describe('GuideUpload session helpers', () => {
  let yar
  let request

  beforeEach(() => {
    yar = {
      set: vi.fn(),
      get: vi.fn()
    }

    request = { yar }
  })

  test('createGuideUpload creates wrapper, persists to session, and hasUpload is false initially', () => {
    const upload = createGuideUpload(request)

    expect(upload).toBeTruthy()
    expect(typeof upload.hasUpload).toBe('function')
    expect(upload.hasUpload()).toBe(false)

    // createGuideUpload should set the session key 'guide-upload'
    expect(yar.set).toHaveBeenCalled()
    const [key, value] = yar.set.mock.calls[0]
    expect(key).toBe('guide-upload')
    expect(value).toEqual({ uploads: [], completedStepIds: [] })
  })

  test('getGuideUpload returns null when no data present', () => {
    yar.get.mockReturnValue(undefined)

    const res = getGuideUpload(request)

    expect(res).toBeNull()
  })

  test('getGuideUpload returns wrapper with activeUploadId and hasUpload true', () => {
    yar.get.mockReturnValue({ uploads: [{ uploadId: 'u-1' }], completedStepIds: [] })

    const upload = getGuideUpload(request)

    expect(upload).toBeTruthy()
    expect(upload.activeUploadId).toBe('u-1')
    expect(upload.hasUpload()).toBe(true)
  })

  test('getGuideUpload hydrates completedStepIds from session', () => {
    yar.get.mockReturnValue({
      uploads: [{ uploadId: 'u-1' }],
      completedStepIds: ['scanning']
    })

    const upload = getGuideUpload(request)

    expect(upload.completedStepIds).toEqual(['scanning'])
  })

  test('addGuideUpload appends to existing uploads and persists', () => {
    yar.get.mockReturnValue({
      uploads: [{ uploadId: 'u-1' }],
      completedStepIds: []
    })

    addGuideUpload(request, 'u-2')

    // Should have set the session with both uploads
    expect(yar.set).toHaveBeenCalled()
    const [key, value] = yar.set.mock.calls[0]
    expect(key).toBe('guide-upload')
    expect(value).toEqual({
      uploads: [{ uploadId: 'u-1' }, { uploadId: 'u-2' }],
      completedStepIds: []
    })
  })

  test('addGuideUpload creates a new wrapper and persists when no existing session data is present', () => {
    yar.get.mockReturnValue(undefined)

    addGuideUpload(request, 'u-1')

    expect(yar.set).toHaveBeenCalled()
    const [key, value] = yar.set.mock.calls[0]
    expect(key).toBe('guide-upload')
    expect(value).toEqual({ uploads: [{ uploadId: 'u-1' }], completedStepIds: [] })
  })

  test('setGuideUploadCompletedSteps persists updated step IDs', () => {
    yar.get.mockReturnValue({
      uploads: [{ uploadId: 'u-1' }],
      completedStepIds: []
    })

    setGuideUploadCompletedSteps(request, ['scanning', 'converting'])

    expect(yar.set).toHaveBeenCalled()
    const [key, value] = yar.set.mock.calls[0]
    expect(key).toBe('guide-upload')
    expect(value.completedStepIds).toEqual(['scanning', 'converting'])
  })

  test('setGuideUploadCompletedSteps does nothing when no upload in session', () => {
    yar.get.mockReturnValue(null)

    setGuideUploadCompletedSteps(request, ['scanning'])

    expect(yar.set).not.toHaveBeenCalled()
  })

  test('GuideUpload instance addUpload and toPlainObject produce correct shape', () => {
    const upload = createGuideUpload(request)

    upload.addUpload('first')
    expect(upload.hasUpload()).toBe(true)
    expect(upload.activeUploadId).toBe('first')

    upload.addUpload('second')
    expect(upload.activeUploadId).toBe('first')

    const plain = upload.toPlainObject()
    expect(plain).toEqual({
      uploads: [{ uploadId: 'first' }, { uploadId: 'second' }],
      completedStepIds: []
    })
  })

  test('GuideUpload tracks completedStepIds', () => {
    const upload = createGuideUpload(request)

    upload.setCompletedStepIds(['scanning'])

    const plain = upload.toPlainObject()
    expect(plain.completedStepIds).toEqual(['scanning'])
  })
})
