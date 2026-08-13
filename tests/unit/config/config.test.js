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
