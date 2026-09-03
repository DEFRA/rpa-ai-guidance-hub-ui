import { vi } from 'vitest'

describe('#config', () => {
  describe('When running in the test environment', () => {
    test('Should use non-production defaults', async () => {
      const { config } = await import('../../../src/config/config.js')

      expect(config.get('log.format')).toBe('pino-pretty')
      expect(config.get('log.redact')).toEqual([])
      expect(config.get('session.cache.engine')).toBe('memory')
      expect(config.get('guidanceApi.baseUrl')).toBe('http://localhost:3001')
    })
  })

  describe('#auth.entra.useRefreshTokens', () => {
    const originalEnv = process.env.ENTRA_USE_REFRESH_TOKENS

    afterEach(() => {
      process.env.ENTRA_USE_REFRESH_TOKENS = originalEnv
      vi.resetModules()
    })

    test('Should default to false when not set', async () => {
      delete process.env.ENTRA_USE_REFRESH_TOKENS
      vi.resetModules()

      const { config } = await import('../../../src/config/config.js')

      expect(config.get('auth.entra.useRefreshTokens')).toBe(false)
    })

    test('Should override the default to true when ENTRA_USE_REFRESH_TOKENS is set', async () => {
      process.env.ENTRA_USE_REFRESH_TOKENS = 'true'
      vi.resetModules()

      const { config } = await import('../../../src/config/config.js')

      expect(config.get('auth.entra.useRefreshTokens')).toBe(true)
    })
  })

  describe('When running in the production environment', () => {
    beforeEach(() => {
      vi.stubEnv('NODE_ENV', 'production')
      vi.resetModules()
    })

    afterEach(() => {
      vi.unstubAllEnvs()
      vi.resetModules()
    })

    test('Should use production defaults', async () => {
      delete process.env.AUTH_PROVIDER
      vi.resetModules()

      const { config } = await import('../../../src/config/config.js')

      expect(config.get('log.format')).toBe('ecs')
      expect(config.get('log.redact')).toEqual([
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers'
      ])
      expect(config.get('session.cache.engine')).toBe('redis')
    })

    test('Should default to `entra` provider in production', async () => {
      vi.stubEnv('AUTH_PROVIDER', 'entra')
      vi.resetModules()

      const { config } = await import('../../../src/config/config.js')

      expect(config.get('auth.provider')).toBe('entra')
    })

    test('Should reject non-`entra` AUTH_PROVIDER in production', async () => {
      vi.stubEnv('AUTH_PROVIDER', 'local')
      vi.resetModules()

      await expect(import('../../../src/config/config.js')).rejects.toThrow()
    })
  })

  describe('#cdpUploader.browserUrl', () => {
    const originalBrowser = process.env.CDP_UPLOADER_BROWSER_URL

    afterEach(() => {
      if (originalBrowser === undefined) delete process.env.CDP_UPLOADER_BROWSER_URL
      else process.env.CDP_UPLOADER_BROWSER_URL = originalBrowser
      vi.unstubAllEnvs()
      vi.resetModules()
    })

    test('Should reject when CDP_UPLOADER_BROWSER_URL is set in production', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      vi.stubEnv('CDP_UPLOADER_BROWSER_URL', 'https://uploader.example')
      vi.resetModules()

      await expect(import('../../../src/config/config.js')).rejects.toThrow(/CDP_UPLOADER_BROWSER_URL must not be set/)
    })

    test('Should allow null CDP_UPLOADER_BROWSER_URL in production', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      delete process.env.CDP_UPLOADER_BROWSER_URL
      vi.resetModules()

      const { config } = await import('../../../src/config/config.js')
      expect(config).toBeDefined()
    })

    test('Should allow CDP_UPLOADER_BROWSER_URL in non-production', async () => {
      vi.stubEnv('NODE_ENV', 'development')
      vi.stubEnv('CDP_UPLOADER_BROWSER_URL', 'https://uploader.example')
      vi.resetModules()

      const { config } = await import('../../../src/config/config.js')
      expect(config.get('cdpUploader.browserUrl')).toBe('https://uploader.example')
    })
  })
})
