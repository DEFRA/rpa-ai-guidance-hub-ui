import { config } from '../../config/config.js'

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

/**
 * RequestOptions - Options for the request function
 * @typedef {Object} RequestOptions
 * @property {string} [method] - The HTTP method (default: 'GET')
 * @property {Object<string, any>?} [body] - The request body
 * @property {Object<string, string>?} [headers] - Additional headers
 * @property {number[]} [expected] - List of expected non-ok status codes that
 *   should be returned as {ok:false} rather than thrown
 */

class GuidanceApiClient {
  /**
   * Create a new guidance API client
   * @param {string} [baseUrl] - The base URL for the API (defaults to config)
   */
  constructor (baseUrl) {
    this.baseUrl = baseUrl || config.get('guidanceApi.baseUrl')
  }

  /**
   * Make an HTTP request to the guidance API
   *
   * @param {string} path - The API endpoint path
   * @param {RequestOptions} [options] - The request options
   * @returns {Promise<{ok: boolean, status: number, data: any}>} - The response object
   * @throws {GuidanceApiError} - When response is not ok and status is not expected
   * @throws {SyntaxError} - When an ok response body isn't valid JSON
   */
  async request (path, options = {}) {
    const method = options.method || 'GET'

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers
      },
      signal: AbortSignal.timeout(config.get('guidanceApi.timeout')),
      body: options.body ? JSON.stringify(options.body) : undefined
    })

    if (response.ok) {
      const data = await response.json()

      return { ok: true, status: response.status, data }
    }

    const expected = options.expected || []

    if (expected.includes(response.status)) {
      return { ok: false, status: response.status, data: null }
    }

    throw GuidanceApiError.fromResponse(method, path, response)
  }
}

const guidanceApiClient = new GuidanceApiClient()

export {
  GuidanceApiClient,
  GuidanceApiError,
  guidanceApiClient
}
