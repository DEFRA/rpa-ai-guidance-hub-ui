import * as stagedDocumentsService from '../../../../../../src/services/staged-documents.js'
import { CONVERSION_MESSAGES, getConversionProgress } from '../../../../../../src/pages/create-guidance/upload-guide/converting/progress.js'

function stagedDocument (fields = {}) {
  return {
    fileId: 'file-1',
    parsingStatus: 'complete',
    documentId: 'document-1',
    savingStatus: 'in_progress',
    saveStepsCompleted: 0,
    saveStepsTotal: null,
    saveError: null,
    ...fields
  }
}

describe('conversion progress', () => {
  test('says why the document cannot be converted, and what to do, in these words', () => {
    expect(CONVERSION_MESSAGES).toEqual({
      failed: 'The document could not be converted',
      failedDetail: 'Go back to check your answers and select Convert document again. If this keeps happening, contact the support team',
      expired: 'The uploaded document has expired',
      expiredDetail: 'Start over and upload it again'
    })
  })

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  test('shows the save starting before the API knows how many parts there are', async () => {
    vi.spyOn(stagedDocumentsService, 'getStagedDocumentById').mockResolvedValue(stagedDocument())

    const progress = await getConversionProgress('file-1')

    expect(progress).toEqual(expect.objectContaining({
      percentage: 0,
      label: 'Starting to convert the document',
      isComplete: false,
      isError: false
    }))
  })

  test('shows how many of the document\'s parts are saved, as a percentage of them all', async () => {
    vi.spyOn(stagedDocumentsService, 'getStagedDocumentById')
      .mockResolvedValue(stagedDocument({ saveStepsCompleted: 37, saveStepsTotal: 74 }))

    const progress = await getConversionProgress('file-1')

    expect(progress).toEqual(expect.objectContaining({
      percentage: 50,
      label: 'Saving the document: 37 of 74 parts saved',
      isComplete: false,
      isError: false
    }))
  })

  test('is complete when the document is saved', async () => {
    vi.spyOn(stagedDocumentsService, 'getStagedDocumentById')
      .mockResolvedValue(stagedDocument({ savingStatus: 'complete', saveStepsCompleted: 74, saveStepsTotal: 74 }))

    const progress = await getConversionProgress('file-1')

    expect(progress).toEqual(expect.objectContaining({
      percentage: 100,
      label: 'Document converted',
      isComplete: true,
      isError: false
    }))
  })

  test('tells the user what to do next when the save fails', async () => {
    vi.spyOn(stagedDocumentsService, 'getStagedDocumentById')
      .mockResolvedValue(stagedDocument({ savingStatus: 'failed', saveStepsCompleted: 3, saveStepsTotal: 74, saveError: 'refused' }))

    const progress = await getConversionProgress('file-1')

    expect(progress).toEqual(expect.objectContaining({
      percentage: 4,
      isComplete: false,
      isError: true,
      message: CONVERSION_MESSAGES.failed,
      detail: CONVERSION_MESSAGES.failedDetail
    }))
  })

  test('tells the user to start again when the upload has expired', async () => {
    vi.spyOn(stagedDocumentsService, 'getStagedDocumentById').mockResolvedValue(null)

    const progress = await getConversionProgress('file-1')

    expect(progress).toEqual(expect.objectContaining({
      isError: true,
      message: CONVERSION_MESSAGES.expired,
      detail: CONVERSION_MESSAGES.expiredDetail
    }))
  })
})
