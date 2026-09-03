import { config } from '../../config/config.js'

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

/**
 * RequestOptions - Options for the request function
 * @typedef {Object} RequestOptions
 * @property {string} [method] - The HTTP method (default: 'GET')
 * @property {Object<string, any>?} [body] - The request body
 * @property {Object<string, string>?} [query] - Query string parameters
 * @property {Object<string, string>?} [headers] - Additional headers
 * @property {number[]} [expected] - List of expected non-ok status codes that
 *   should be returned as {ok:false} rather than thrown
 */

class CdpUploaderClient {
  /**
   * Create a new cdp-uploader API client
   * @param {string} [baseUrl] - The base URL for the API (defaults to config)
   */
  constructor (baseUrl) {
    this.baseUrl = baseUrl || config.get('cdpUploader.baseUrl')
  }

  /**
   * Make an HTTP request to the cdp-uploader API
   *
   * @param {string} path - The API endpoint path
   * @param {RequestOptions} [options] - The request options
   * @returns {Promise<{ok: boolean, status: number, data: any}>} - The response object
   * @throws {CdpUploaderError} - When response is not ok and status is not in expected list
   * @throws {SyntaxError} - When an ok response body isn't valid JSON
   */
  async request (path, options = {}) {
    const method = options.method || 'GET'
    const url = new URL(`${this.baseUrl}${path}`)

    for (const [key, value] of Object.entries(options.query || {})) {
      if (value !== undefined) {
        url.searchParams.set(key, value)
      }
    }

    const response = await fetch(url, {
      method,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers
      },
      signal: AbortSignal.timeout(config.get('cdpUploader.requestTimeout')),
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

    throw CdpUploaderError.fromResponse(method, path, response)
  }
}

const cdpUploaderClient = new CdpUploaderClient()

export {
  CdpUploaderClient,
  CdpUploaderError,
  cdpUploaderClient
}
