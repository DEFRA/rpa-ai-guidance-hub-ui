import { config } from '../../config/config.js'
import { ApiClient } from '../api-client.js'

/**
 * CdpUploaderError - Error class for unexpected cdp-uploader API responses
 */
class CdpUploaderError extends Error {
  constructor (message, statusCode) {
    super(message)
    this.name = 'CdpUploaderError'
    this.statusCode = statusCode
  }

  static fromResponse (method, path, response) {
    const message =
      `cdp-uploader API ${method} ${path} ` +
      `failed: ${response.status} ${response.statusText}`

    return new CdpUploaderError(message, response.status)
  }
}

class CdpUploaderClient extends ApiClient {
  /**
   * Create a new cdp-uploader API client
   * @param {string} [baseUrl] - The base URL for the API (defaults to config)
   */
  constructor (baseUrl) {
    super({
      baseUrl: baseUrl || config.get('cdpUploader.baseUrl'),
      timeout: config.get('cdpUploader.requestTimeout'),
      errorClass: CdpUploaderError
    })
  }
}

const cdpUploaderClient = new CdpUploaderClient()

export {
  CdpUploaderClient,
  CdpUploaderError,
  cdpUploaderClient
}
