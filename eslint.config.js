import { globalIgnores } from 'eslint/config'
import neostandard from 'neostandard'

// One module owns each external contract's response shapes, so a test stubs a
// response with a factory in `tests/fixtures/`, never with a body of its own.
// These files have bodies from before this check: take a file off the list
// when its bodies move.
const FILES_WITH_THEIR_OWN_RESPONSE_BODIES = [
  'tests/integration/pages/create-guidance/upload-guide/metadata/check-answers/check-answers.test.js',
  'tests/integration/pages/login/entra-login.test.js',
  'tests/integration/server/plugins/auth/auth.test.js',
  'tests/integration/services/guides.test.js',
  'tests/unit/infra/api-client.test.js',
  'tests/unit/infra/cdp-uploader/client.test.js',
  'tests/unit/infra/guidance-api/client.test.js',
  'tests/unit/infra/guidance-api/reference-data.test.js',
  'tests/unit/pages/login/controller.test.js',
  'tests/unit/server/plugins/auth/oidc.test.js',
  'tests/unit/services/reference-data.test.js',
  'tests/unit/services/staged-documents.test.js'
]

const OWN_RESPONSE_BODY = 'Stub a response with a factory in tests/fixtures/, adding one for a new response, so that one place owns its shape, verified against its contract.'
const BODY = ':matches(ObjectExpression[properties.length>0], ArrayExpression[elements.length>0])'

export default [
  globalIgnores(neostandard.resolveIgnoresFromGitignore()),
  ...neostandard({
    env: ['node', 'vitest'],
    noJsx: true
  }),
  {
    files: ['tests/**/*.js'],
    ignores: ['tests/fixtures/**', ...FILES_WITH_THEIR_OWN_RESPONSE_BODIES],
    rules: {
      'no-restricted-syntax': ['error',
        {
          selector: `CallExpression[callee.property.name='reply'] > ${BODY}:nth-child(2)`,
          message: OWN_RESPONSE_BODY
        },
        {
          selector: `CallExpression[callee.property.name=/^mock(Resolved|Return)Value(Once)?$/] > ObjectExpression > Property[key.name='data'] > ${BODY}`,
          message: OWN_RESPONSE_BODY
        }
      ]
    }
  }
]
