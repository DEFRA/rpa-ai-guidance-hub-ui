import { sessionCache } from '../../../src/server/plugins/session-cache/session-cache.js'
import { config } from '../../../src/config/config.js'

describe('sessionCache plugin', () => {
  test('always uses server-side storage by setting maxCookieSize to 0', () => {
    expect(sessionCache.options.maxCookieSize).toBe(0)
  })

  test('derives cookie options from session config', () => {
    expect(sessionCache.options.cookieOptions).toEqual({
      password: config.get('session.cookie.password'),
      ttl: config.get('session.cookie.ttl'),
      isSecure: config.get('session.cookie.secure'),
      clearInvalid: true
    })
  })
})
