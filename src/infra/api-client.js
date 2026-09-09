/**
 * ApiClient - Shared base class for HTTP clients
 */
class ApiClient {
  /**
   * @param {Object} options
   * @param {string} options.baseUrl - The base URL for the API
   * @param {number} [options.timeout] - Request timeout in milliseconds
   * @param {typeof Error} options.errorClass - Error class to throw on non-ok status
   */
  constructor ({ baseUrl, timeout, errorClass }) {
    this.baseUrl = baseUrl
    this.timeout = timeout
    this.errorClass = errorClass
  }

  /**
   * Make an HTTP request
   *
   * @param {string} path - The API endpoint path
   * @param {Object} [options] - The request options
   * @param {string} [options.method] - The HTTP method (default: 'GET')
   * @param {Object<string, any>?} [options.body] - The request body
   * @param {Object<string, string>?} [options.query] - Query string parameters
   * @param {Object<string, string>?} [options.headers] - Additional headers
   * @param {number[]} [options.expected] - List of expected non-ok status codes
   * @returns {Promise<{ok: boolean, status: number, data: any}>} - The response object
   * @throws {Error} - When response is not ok and status is not in expected list
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
      signal: this.timeout ? AbortSignal.timeout(this.timeout) : undefined,
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

    throw this.errorClass.fromResponse(method, path, response)
  }
}

export {
  ApiClient
}
