import { createServer } from '../../../../src/server/server.js'

describe('#contentSecurityPolicy', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server?.stop({ timeout: 0 })
  })

  test('Should set the CSP policy header', async () => {
    const resp = await server.inject({
      method: 'GET',
      url: '/'
    })

    expect(resp.headers['content-security-policy']).toBeDefined()
  })

  test('Should include nonces in CSP header when enabled', async () => {
    const resp = await server.inject({
      method: 'GET',
      url: '/'
    })

    const csp = resp.headers['content-security-policy'] || ''

    expect(csp).toMatch(/script-src[^;]*'nonce-[^']+'/)
    expect(csp).toMatch(/style-src[^;]*'nonce-[^']+'/)
  })

  test('registers the blankie plugin when CDP_UPLOADER_BROWSER_URL is not set', () => {
    // blankie exposes nothing on server.plugins - server.registrations is
    // the actual record of what got registered
    expect(server.registrations.blankie).toBeDefined()
  })
})

describe('when CDP_UPLOADER_BROWSER_URL is set', () => {
  let server

  // The uploader browser posts directly to that external origin (see
  // src/server/server.js), so the CSP plugin is skipped rather than
  // reconfigured - a fresh server needs its own module graph to pick this up
  beforeAll(async () => {
    vi.stubEnv('CDP_UPLOADER_BROWSER_URL', 'http://browser.test')
    vi.resetModules()

    const { createServer: createServerWithBrowserUrl } = await import('../../../../src/server/server.js')
    server = await createServerWithBrowserUrl()
    await server.initialize()
  })

  afterAll(async () => {
    await server?.stop({ timeout: 0 })
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  test('does not register the blankie plugin', () => {
    expect(server.registrations.blankie).toBeUndefined()
  })

  test('does not set a content-security-policy header', async () => {
    const resp = await server.inject({ method: 'GET', url: '/' })

    expect(resp.headers['content-security-policy']).toBeUndefined()
  })
})

describe('when GTM_CONTAINER_ID is set', () => {
  let server

  beforeAll(async () => {
    vi.stubEnv('GTM_CONTAINER_ID', 'GTM-TEST123')
    vi.resetModules()

    const { createServer: createServerWithGtm } = await import('../../../../src/server/server.js')
    server = await createServerWithGtm()
    await server.initialize()
  })

  afterAll(async () => {
    await server?.stop({ timeout: 0 })
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  async function directive (name) {
    const { headers } = await server.inject({ method: 'GET', url: '/' })

    return headers['content-security-policy']
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${name} `))
  }

  test('allows scripts from Tag Manager and Google Analytics', async () => {
    const scriptSrc = await directive('script-src')

    expect(scriptSrc).toContain('https://www.googletagmanager.com')
    expect(scriptSrc).toContain('https://www.google-analytics.com')
  })

  test('allows Google Analytics to send its data', async () => {
    expect(await directive('connect-src'))
      .toContain('https://region1.google-analytics.com')
  })
})

describe('when GTM_CONTAINER_ID is not set', () => {
  test('allows nothing from Google', async () => {
    const server = await createServer()
    await server.initialize()
    const { headers } = await server.inject({ method: 'GET', url: '/' })
    await server.stop({ timeout: 0 })

    expect(headers['content-security-policy']).not.toContain('google')
  })
})
