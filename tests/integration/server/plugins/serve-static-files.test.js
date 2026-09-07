import { constants as statusCodes } from 'node:http2'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { vi } from 'vitest'

const __dirname = dirname(fileURLToPath(import.meta.url))

describe('#serveStaticFiles', () => {
  let server

  const manifestPath = join(__dirname, '../../../../.public/.vite/manifest.json')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))

  const faviconSvgHash = manifest['node_modules/govuk-frontend/dist/govuk/assets/images/favicon.svg'].file.split('/').pop()

  describe('When secure context is disabled', () => {
    beforeAll(async () => {
      vi.stubEnv('PORT', '3098')
      vi.resetModules()

      const { createServer: createServerWithCustomPort, startServer: startServerWithCustomPort } =
        await import('../../../../src/server/server.js')

      server = await createServerWithCustomPort()
      await startServerWithCustomPort(server)
    })

    afterAll(async () => {
      await server.stop({ timeout: 0 })
      vi.unstubAllEnvs()
      vi.resetModules()
    })

    test('Should serve favicon as expected', async () => {
      const { statusCode } = await server.inject({
        method: 'GET',
        url: '/favicon.ico'
      })

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_NO_CONTENT)
    })

    test('Should serve assets as expected', async () => {
      const { statusCode } = await server.inject({
        method: 'GET',
        url: `/public/assets/${faviconSvgHash}`
      })

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_OK)
    })
  })
})
