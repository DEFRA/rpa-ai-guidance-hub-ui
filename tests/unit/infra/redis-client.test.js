import { vi } from 'vitest'

import { Cluster, Redis } from 'ioredis'

import { config } from '../../../src/config/config.js'
import { buildRedisClient } from '../../../src/infra/redis-client.js'
import { buildErrorLog } from '../../../src/infra/logging/utils/build-error-log.js'

const mockLoggerInfo = vi.fn()
const mockLoggerError = vi.fn()

function buildMockClient () {
  const listeners = {}

  return {
    on: vi.fn((event, callback) => {
      listeners[event] = callback
    }),
    emit: (event, ...args) => listeners[event](...args)
  }
}

vi.mock('ioredis', () => ({
  ...vi.importActual('ioredis'),
  Cluster: vi.fn(buildMockClient),
  Redis: vi.fn(buildMockClient)
}))

vi.mock('../../../src/infra/logging/logger.js', () => ({
  createLogger: () => ({
    info: (...args) => mockLoggerInfo(...args),
    error: (...args) => mockLoggerError(...args)
  })
}))

describe('#buildRedisClient', () => {
  describe('When Redis Single InstanceCache is requested', () => {
    beforeEach(() => {
      buildRedisClient(config.get('redis'))
    })

    test('Should instantiate a single Redis client', () => {
      expect(Redis).toHaveBeenCalledWith({
        db: 0,
        host: '127.0.0.1',
        keyPrefix: 'rpa-ai-guidance-hub-ui:',
        port: 6379
      })
    })
  })

  describe('When a Redis Cluster is requested', () => {
    beforeEach(() => {
      buildRedisClient({
        ...config.get('redis'),
        useSingleInstanceCache: false,
        useTLS: true,
        username: 'user',
        password: 'pass'
      })
    })

    test('Should instantiate a Redis Cluster client', () => {
      expect(Cluster).toHaveBeenCalledWith(
        [{ host: '127.0.0.1', port: 6379 }],
        {
          dnsLookup: expect.any(Function),
          keyPrefix: 'rpa-ai-guidance-hub-ui:',
          redisOptions: { db: 0, password: 'pass', tls: {}, username: 'user' },
          slotsRefreshTimeout: 10000
        }
      )
    })

    test('Should resolve the address unchanged via the cluster dnsLookup callback', () => {
      const { dnsLookup } = Cluster.mock.calls[0][1]
      const callback = vi.fn()

      dnsLookup('some-address', callback)

      expect(callback).toHaveBeenCalledWith(null, 'some-address')
    })
  })

  describe('When the client connects', () => {
    test('Should log that the connection was made', () => {
      const client = buildRedisClient(config.get('redis'))

      client.emit('connect')

      expect(mockLoggerInfo).toHaveBeenCalledWith('Connected to Redis server')
    })
  })

  describe('When the client errors', () => {
    test('Should log the connection error', () => {
      const client = buildRedisClient(config.get('redis'))
      const error = new Error('connection refused')

      client.emit('error', error)

      expect(mockLoggerError).toHaveBeenCalledWith(
        buildErrorLog(error, { type: 'redis_connection_error' }),
        'Redis connection error'
      )
    })
  })
})
