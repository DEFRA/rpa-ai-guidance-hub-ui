import { globalIgnores } from 'eslint/config'
import neostandard from 'neostandard'

// Since neostandard 0.14, its `ignores` option only skips its own rules, so the
// gitignored paths (such as the built .public assets) are ignored globally here.
export default [
  globalIgnores(neostandard.resolveIgnoresFromGitignore()),
  ...neostandard({
    env: ['node', 'vitest'],
    noJsx: true
  })
]
