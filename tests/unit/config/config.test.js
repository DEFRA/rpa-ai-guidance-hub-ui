import { vi } from 'vitest'

describe('#config', () => {
  describe('When running in the test environment', () => {
    test('Should use non-production defaults', async () => {
      const { config } = await import('../../../src/config/config.js')

      expect(config.get('log.format')).toBe('pino-pretty')
      expect(config.get('log.redact')).toEqual([])
      expect(config.get('session.cache.engine')).toBe('memory')
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
    const originalNodeEnv = process.env.NODE_ENV

    beforeEach(() => {
      process.env.NODE_ENV = 'production'
      vi.resetModules()
    })

    afterEach(() => {
      process.env.NODE_ENV = originalNodeEnv
      vi.resetModules()
    })

    test('Should use production defaults', async () => {
      const { config } = await import('../../../src/config/config.js')

      expect(config.get('log.format')).toBe('ecs')
      expect(config.get('log.redact')).toEqual([
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers'
      ])
      expect(config.get('session.cache.engine')).toBe('redis')
    })
  })
})
