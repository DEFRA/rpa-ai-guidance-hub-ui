process.env.SESSION_COOKIE_PASSWORD = 'the-password-must-be-at-least-32-characters-long'
process.env.REDIS_USERNAME = 'user'
process.env.REDIS_PASSWORD = 'pass'
process.env.AUTH_PROVIDER = 'local'
process.env.ENTRA_TENANT_ID = 'fake-tenant-id'
process.env.ENTRA_CLIENT_ID = 'fake-client-id'
process.env.ENTRA_CLIENT_SECRET = 'fake-client-secret'
process.env.ENTRA_REDIRECT_HOST = 'http://localhost:3000'
process.env.GUIDANCE_API_BASE_URL = 'http://localhost:3001'
process.env.CDP_UPLOADER_BASE_URL = 'http://cdp-uploader.test'
process.env.SOURCE_DOCS_S3_BUCKET = 'rpa-ai-guidance-hub-source-docs'

import { afterEach, vi } from 'vitest'

// Mock global fetch for CDP uploader endpoints
const originalFetch = globalThis.fetch

globalThis.fetch = vi.fn(async (url, options = {}) => {
  const urlString = url instanceof URL ? url.href : url

  // Default mock behavior for CDP uploader
  if (urlString.includes('cdp-uploader.test')) {
    if (urlString.includes('/initiate')) {
      return new Response(JSON.stringify({
        uploadId: 'test-id',
        uploadUrl: 'http://cdp-uploader.test/upload',
        statusUrl: 'http://cdp-uploader.test/status'
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    }

    if (urlString.includes('/status/')) {
      return new Response(JSON.stringify({
        uploadStatus: 'initiated',
        form: {},
        metadata: {}
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    }
  }

  // Fall back to original fetch for everything else
  return originalFetch(url, options)
})

afterEach(() => {
  vi.clearAllMocks()
})
