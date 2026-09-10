import { config } from '../../config/config.js'
import { ApiClient } from '../api-client.js'

/**
 * GuidanceApiError - Error class for unexpected guidance API responses
 */
class GuidanceApiError extends Error {
  constructor (message, statusCode) {
    super(message)
    this.name = 'GuidanceApiError'
    this.statusCode = statusCode
  }

  static fromResponse (method, path, response) {
    const message =
      `guidance API ${method} ${path} ` +
      `failed: ${response.status} ${response.statusText}`

    return new GuidanceApiError(message, response.status)
  }
}

class GuidanceApiClient extends ApiClient {
  /**
   * Create a new guidance API client
   * @param {string} [baseUrl] - The base URL for the API (defaults to config)
   */
  constructor (baseUrl) {
    super({
      baseUrl: baseUrl || config.get('guidanceApi.baseUrl'),
      timeout: config.get('guidanceApi.timeout'),
      errorClass: GuidanceApiError
    })
  }
}

const guidanceApiClient = new GuidanceApiClient()

export {
  GuidanceApiClient,
  GuidanceApiError,
  guidanceApiClient
}
