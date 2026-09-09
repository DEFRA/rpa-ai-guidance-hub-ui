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
    expect(upload.hasUpload()).toBe(false)
    expect(upload.activeUploadId).toBeNull()
    expect(upload.completedStepIds).toEqual([])

    expect(yar.set).toHaveBeenCalledWith('guide-upload', { uploads: [] })
  })

  test('getGuideUpload returns null when no data present', () => {
    yar.get.mockReturnValue(undefined)

    expect(getGuideUpload(request)).toBeNull()
  })

  test('getGuideUpload returns wrapper with activeUploadId and hasUpload true', () => {
    yar.get.mockReturnValue({ uploads: [{ uploadId: 'u-1', completedStepIds: [] }] })

    const upload = getGuideUpload(request)

    expect(upload.activeUploadId).toBe('u-1')
    expect(upload.hasUpload()).toBe(true)
  })

  test('the most recent upload is the active one', () => {
    yar.get.mockReturnValue({
      uploads: [
        { uploadId: 'rejected', completedStepIds: [] },
        { uploadId: 'retry', completedStepIds: [] }
      ]
    })

    expect(getGuideUpload(request).activeUploadId).toBe('retry')
  })

  test('completedStepIds belong to the active upload only', () => {
    yar.get.mockReturnValue({
      uploads: [
        { uploadId: 'rejected', completedStepIds: ['scanning'] },
        { uploadId: 'retry', completedStepIds: [] }
      ]
    })

    expect(getGuideUpload(request).completedStepIds).toEqual([])
  })

  test('tolerates upload entries saved without completedStepIds', () => {
    yar.get.mockReturnValue({ uploads: [{ uploadId: 'u-1' }] })

    expect(getGuideUpload(request).completedStepIds).toEqual([])
  })

  test('addGuideUpload appends a fresh upload and persists', () => {
    yar.get.mockReturnValue({ uploads: [{ uploadId: 'u-1', completedStepIds: ['scanning'] }] })

    addGuideUpload(request, 'u-2')

    expect(yar.set).toHaveBeenCalledWith('guide-upload', {
      uploads: [
        { uploadId: 'u-1', completedStepIds: ['scanning'] },
        { uploadId: 'u-2', completedStepIds: [] }
      ]
    })
  })

  test('addGuideUpload creates a new wrapper and persists when no existing session data is present', () => {
    yar.get.mockReturnValue(undefined)

    addGuideUpload(request, 'u-1')

    expect(yar.set).toHaveBeenCalledWith('guide-upload', {
      uploads: [{ uploadId: 'u-1', completedStepIds: [] }]
    })
  })

  test('setGuideUploadCompletedSteps persists step IDs against the active upload', () => {
    yar.get.mockReturnValue({
      uploads: [
        { uploadId: 'u-1', completedStepIds: [] },
        { uploadId: 'u-2', completedStepIds: [] }
      ]
    })

    setGuideUploadCompletedSteps(request, ['scanning', 'converting'])

    expect(yar.set).toHaveBeenCalledWith('guide-upload', {
      uploads: [
        { uploadId: 'u-1', completedStepIds: [] },
        { uploadId: 'u-2', completedStepIds: ['scanning', 'converting'] }
      ]
    })
  })

  test('setGuideUploadCompletedSteps does nothing when no upload in session', () => {
    yar.get.mockReturnValue(null)

    setGuideUploadCompletedSteps(request, ['scanning'])

    expect(yar.set).not.toHaveBeenCalled()
  })

  test('setCompletedStepIds is a no-op on a wrapper with no uploads', () => {
    const upload = createGuideUpload(request)

    upload.setCompletedStepIds(['scanning'])

    expect(upload.completedStepIds).toEqual([])
  })

  test('setCompletedStepIds copies the array it is given', () => {
    const upload = createGuideUpload(request)
    const ids = ['scanning']

    upload.addUpload('u-1')
    upload.setCompletedStepIds(ids)
    ids.push('converting')

    expect(upload.completedStepIds).toEqual(['scanning'])
  })
})
