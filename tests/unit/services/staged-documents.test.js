import { statusCodes } from '../../../src/constants/status-codes.js'
import * as stagedDocumentsApi from '../../../src/infra/guidance-api/staged-documents.js'
import {
  getStagedDocumentById
} from '../../../src/services/staged-documents.js'

describe('staged-documents service', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  test('returns shaped staged document when found', async () => {
    vi.spyOn(stagedDocumentsApi, 'getStagedDocument').mockResolvedValue({
      ok: true,
      status: statusCodes.HTTP_STATUS_OK,
      data: {
        fileId: 'file-1',
        parsingStatus: 'complete',
        parsingError: null,
        title: 'Guide Title',
        version: '1.0',
        lastModified: '2026-05-10T12:00:00.000Z'
      }
    })

    const result = await getStagedDocumentById('file-1')

    expect(result).toEqual({
      fileId: 'file-1',
      parsingStatus: 'complete',
      parsingError: null,
      title: 'Guide Title',
      version: '1.0',
      lastModified: '2026-05-10T12:00:00.000Z',
      documentId: null,
      promotedAt: null
    })
  })

  test('fills null defaults for missing optional fields', async () => {
    vi.spyOn(stagedDocumentsApi, 'getStagedDocument').mockResolvedValue({
      ok: true,
      status: statusCodes.HTTP_STATUS_OK,
      data: {
        fileId: 'file-1',
        parsingStatus: 'pending'
      }
    })

    const result = await getStagedDocumentById('file-1')

    expect(result).toEqual({
      fileId: 'file-1',
      parsingStatus: 'pending',
      parsingError: null,
      title: null,
      version: null,
      lastModified: null,
      documentId: null,
      promotedAt: null
    })
  })

  test('returns the document it was converted into, and when that was committed', async () => {
    vi.spyOn(stagedDocumentsApi, 'getStagedDocument').mockResolvedValue({
      ok: true,
      status: statusCodes.HTTP_STATUS_OK,
      data: {
        fileId: 'file-1',
        parsingStatus: 'complete',
        documentId: 'document-1',
        promotedAt: '2026-10-06T11:00:00Z'
      }
    })

    const result = await getStagedDocumentById('file-1')

    expect(result).toEqual(expect.objectContaining({
      documentId: 'document-1',
      promotedAt: '2026-10-06T11:00:00Z'
    }))
  })

  test('returns null when document is not found (404)', async () => {
    vi.spyOn(stagedDocumentsApi, 'getStagedDocument').mockResolvedValue({
      ok: false,
      status: statusCodes.HTTP_STATUS_NOT_FOUND,
      data: null
    })

    const result = await getStagedDocumentById('missing-file')

    expect(result).toBeNull()
  })

  test('propagates rejection when infra call fails', async () => {
    const error = new Error('Network error')
    vi.spyOn(stagedDocumentsApi, 'getStagedDocument').mockRejectedValue(error)

    await expect(getStagedDocumentById('file-1')).rejects.toThrow('Network error')
  })
})
