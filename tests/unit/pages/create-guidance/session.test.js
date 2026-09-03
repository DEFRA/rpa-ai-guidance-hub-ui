import { vi, describe, test, expect, beforeEach } from 'vitest'

import { getGuideUpload, createGuideUpload, addGuideUpload } from '../../../../src/pages/create-guidance/session.js'

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
    expect(value).toEqual({ uploads: [] })
  })

  test('getGuideUpload returns null when no data present', () => {
    yar.get.mockReturnValue(undefined)

    const res = getGuideUpload(request)

    expect(res).toBeNull()
  })

  test('getGuideUpload returns wrapper with activeUploadId and hasUpload true', () => {
    yar.get.mockReturnValue({ uploads: [{ uploadId: 'u-1' }] })

    const upload = getGuideUpload(request)

    expect(upload).toBeTruthy()
    expect(upload.activeUploadId).toBe('u-1')
    expect(upload.hasUpload()).toBe(true)
  })

  test('addGuideUpload appends to existing uploads and persists', () => {
    yar.get.mockReturnValue({ uploads: [{ uploadId: 'u-1' }] })

    addGuideUpload(request, 'u-2')

    // Should have set the session with both uploads
    expect(yar.set).toHaveBeenCalled()
    const [key, value] = yar.set.mock.calls[0]
    expect(key).toBe('guide-upload')
    expect(value).toEqual({ uploads: [{ uploadId: 'u-1' }, { uploadId: 'u-2' }] })
  })

  test('GuideUpload instance addUpload and toPlainObject produce correct shape', () => {
    const upload = createGuideUpload(request)

    upload.addUpload('first')
    expect(upload.hasUpload()).toBe(true)
    expect(upload.activeUploadId).toBe('first')

    upload.addUpload('second')
    expect(upload.activeUploadId).toBe('first')

    const plain = upload.toPlainObject()
    expect(plain).toEqual({ uploads: [{ uploadId: 'first' }, { uploadId: 'second' }] })
  })
})
