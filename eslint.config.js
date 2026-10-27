import { globalIgnores } from 'eslint/config'
import neostandard from 'neostandard'

export default [
  globalIgnores(neostandard.resolveIgnoresFromGitignore()),
  ...neostandard({
    env: ['node', 'vitest'],
    noJsx: true
  })
]
