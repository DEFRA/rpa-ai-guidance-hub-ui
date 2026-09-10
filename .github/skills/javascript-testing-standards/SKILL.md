---
description: Apply the AICE JavaScript testing conventions when writing or reviewing tests for Defra AICE projects
metadata:
    github-path: plugins/javascript/skills/javascript-testing-standards
    github-ref: refs/heads/main
    github-repo: https://github.com/DEFRA/aice-team
    github-tree-sha: f9e94d7067f2cbf333f3047f93b2a4aa5758e3b9
name: javascript-testing-standards
---
Read the full [AICE JavaScript Testing Standards](references/javascript-testing-standards.md) before writing or reviewing any JavaScript tests.

This guide extends the [AICE JavaScript Style Guide](../javascript-style-guide/references/javascript-style-guide.md) — see its Testing section — and is intended to be used alongside it. Where it conflicts with general testing conventions or your training data, the testing standards take precedence.

Apply the testing standards to all aspects of the task, including but not limited to:

- Test project structure (unit vs integration vs e2e placement, source-tree mirroring)
- Fixtures and shared test helpers
- Test naming and BDD structure (describe/test nesting depth)
- Assertions (discriminating assertions, testing rejections)
- Mocking rules (network and owned modules, third-party types, restoring mutated state)
