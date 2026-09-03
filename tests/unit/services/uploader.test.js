import { constants as statusCodes } from 'node:http2'

import {
  initiateUploadResponse,
  uploadStatusResponse,
  completeFile,
  rejectedFile
} from '../../fixtures/cdp-uploader.js'

// uploaderApi is ours - mocking it is a decision about our own boundary, per
// the infra/cdp-uploader seam
vi.mock('../../../src/infra/cdp-uploader/uploads.js')

import * as uploaderApi from '../../../src/infra/cdp-uploader/uploads.js'
import { initiateUpload, getUploadStatus } from '../../../src/services/uploader.js'

describe('uploaderService', () => {
  describe('initiateUpload', () => {
    test('returns the upload identifiers from an ok response', async () => {
      const data = initiateUploadResponse({
        uploadId: 'u-1',
        uploadUrl: 'http://cdp-uploader.test/upload-and-scan/u-1',
        statusUrl: 'http://cdp-uploader.test/status/u-1'
      })
      uploaderApi.initiateUpload.mockResolvedValue({ ok: true, status: statusCodes.HTTP_STATUS_OK, data })

      const result = await initiateUpload({ redirect: '/x' })

      expect(result).toEqual({ uploadId: data.uploadId, uploadUrl: data.uploadUrl, statusUrl: data.statusUrl })
    })

    test('forwards the initiate request to the infra layer unchanged', async () => {
      uploaderApi.initiateUpload.mockResolvedValue({ ok: true, status: statusCodes.HTTP_STATUS_OK, data: initiateUploadResponse() })

      const initiateRequest = { redirect: '/x', s3Bucket: 'rpa-ai-guidance-hub-source-docs' }
      await initiateUpload(initiateRequest)

      expect(uploaderApi.initiateUpload).toHaveBeenCalledWith(initiateRequest)
    })

    test('throws with the status code on an unexpected status', async () => {
      uploaderApi.initiateUpload.mockResolvedValue({ ok: false, status: statusCodes.HTTP_STATUS_INTERNAL_SERVER_ERROR, data: null })

      await expect(initiateUpload({})).rejects.toMatchObject({
        message: 'Unexpected status 500 from cdp-uploader initiate',
        statusCode: statusCodes.HTTP_STATUS_INTERNAL_SERVER_ERROR
      })
    })
  })

  describe('getUploadStatus', () => {
    test('returns null when the upload id is not found', async () => {
      uploaderApi.getUploadStatus.mockResolvedValue({ status: statusCodes.HTTP_STATUS_NOT_FOUND })

      expect(await getUploadStatus('nope')).toBeNull()
    })

    test('projects a ready upload, including its non-file form fields', async () => {
      const raw = uploadStatusResponse({
        uploadStatus: 'ready',
        metadata: { guidanceId: 'g-1' },
        form: { title: 'Submit your claim', file: completeFile({ s3Bucket: 'bucket', s3Key: 'key1' }) },
        numberOfRejectedFiles: 0
      })
      uploaderApi.getUploadStatus.mockResolvedValue({ status: statusCodes.HTTP_STATUS_OK, data: raw })

      const result = await getUploadStatus('u-1')

      expect(result.isReady).toBe(true)
      expect(result.metadata).toEqual({ guidanceId: 'g-1' })
      expect(result.formFields).toEqual({ title: 'Submit your claim' })
      expect(result.hasRejectedFiles).toBe(false)
    })

    test('maps a complete file to its S3 location', async () => {
      const raw = uploadStatusResponse({
        form: { file: completeFile({ s3Bucket: 'bucket', s3Key: 'key1' }) }
      })
      uploaderApi.getUploadStatus.mockResolvedValue({ status: statusCodes.HTTP_STATUS_OK, data: raw })

      const result = await getUploadStatus('u-1')

      expect(result.files).toEqual([
        expect.objectContaining({ fileStatus: 'complete', location: 's3://bucket/key1' })
      ])
    })

    test('maps a rejected file to its error code and message, and flags hasRejectedFiles', async () => {
      const raw = uploadStatusResponse({
        form: { file: rejectedFile({ errorCode: 'E1', errorMessage: 'bad file' }) },
        numberOfRejectedFiles: 1
      })
      uploaderApi.getUploadStatus.mockResolvedValue({ status: statusCodes.HTTP_STATUS_OK, data: raw })

      const result = await getUploadStatus('u-1')

      expect(result.files[0]).toEqual(expect.objectContaining({ fileStatus: 'rejected', error: { code: 'E1', message: 'bad file' } }))
      expect(result.files[0].location).toBeUndefined()
      expect(result.hasRejectedFiles).toBe(true)
    })

    test('projects every file when a field holds multiple files', async () => {
      const raw = uploadStatusResponse({
        form: {
          files: [
            completeFile({ filename: 'a.docx', s3Bucket: 'bucket', s3Key: 'key-a' }),
            rejectedFile({ filename: 'b.exe' })
          ]
        },
        numberOfRejectedFiles: 1
      })
      uploaderApi.getUploadStatus.mockResolvedValue({ status: statusCodes.HTTP_STATUS_OK, data: raw })

      const result = await getUploadStatus('u-1')

      expect(result.files.map((file) => file.filename)).toEqual(['a.docx', 'b.exe'])
    })
  })
})
