import { GuidanceApiClient, GuidanceApiError } from '../../../../src/infra/guidance-api/client.js'

describe('GuidanceApiClient', () => {
  let client

  beforeEach(() => {
    client = new GuidanceApiClient('http://test-guidance-api')
    vi.restoreAllMocks()
  })

  test('request() returns parsed JSON on 200 OK', async () => {
    const mockData = { id: 'g-1', content: 'markdown-content' }
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue(mockData)
    })

    const result = await client.request('/guides')

    expect(result).toEqual({ ok: true, status: 200, data: mockData })
    expect(global.fetch).toHaveBeenCalled()
  })

  test('request() sends JSON body and headers when provided', async () => {
    const payload = { source: { uploadId: 'u-1' } }
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: vi.fn().mockResolvedValue({ id: 'g-1' })
    })

    await client.request('/guides', {
      method: 'POST',
      body: payload
    })

    expect(global.fetch).toHaveBeenCalledWith(
      new URL('http://test-guidance-api/guides'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json'
        }),
        body: JSON.stringify(payload)
      })
    )
  })

  test('request() handles expected status codes gracefully without throwing', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found'
    })

    const result = await client.request('/documents/123/metadata', { expected: [404] })

    expect(result).toEqual({ ok: false, status: 404, data: null })
  })

  test('request() throws GuidanceApiError on unexpected non-ok status', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error'
    })

    await expect(client.request('/guides')).rejects.toThrow(GuidanceApiError)
  })

  test('GuidanceApiError contains status code and message', () => {
    const err = GuidanceApiError.fromResponse('POST', '/guides', {
      status: 500,
      statusText: 'Internal Server Error'
    })

    expect(err.statusCode).toBe(500)
    expect(err.message).toBe('guidance API POST /guides failed: 500 Internal Server Error')
  })
})
