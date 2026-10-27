import { defineConfig, configDefaults } from 'vitest/config'

// Integration tests start a full hapi server, which loads every page's routes
// on first start. Under CPU load that can take over 10 seconds.
const integrationTimeoutMs = 30000

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    clearMocks: true,
    setupFiles: ['./vitest.setup.js'],
    coverage: {
      ...configDefaults.coverage,
      reportOnFailure: true,
      clean: false,
      reportsDirectory: 'coverage',
      reporter: ['lcov'],
      include: ['src/**/*.js'],
      exclude: ['**/node_modules/**', '**/tests/**', '.server', 'src/index.js']
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.js']
        }
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.js'],
          testTimeout: integrationTimeoutMs,
          hookTimeout: integrationTimeoutMs
        }
      }
    ]
  }
})
