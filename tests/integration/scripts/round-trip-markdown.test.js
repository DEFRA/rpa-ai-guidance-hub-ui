import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const script = path.resolve('scripts/round-trip-markdown.js')

function roundTrip (markdown) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'round-trip-'))
  const source = path.join(directory, 'document.md')
  const destination = path.join(directory, 'saved.md')
  fs.writeFileSync(source, markdown, 'utf8')

  try {
    execFileSync(process.execPath, [script, source, destination])
    return fs.readFileSync(destination, 'utf8')
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
}

describe('#round-trip-markdown script', () => {
  test('Should write the document as the editor saves it', () => {
    const saved = roundTrip('# Title\n\nSome <u>underlined</u> text.\n')

    expect(saved).toContain('# Title')
    expect(saved).toContain('++underlined++')
  })

  test('Should read HTML in the document as a browser does', () => {
    const saved = roundTrip(
      '| A | B |\n| --- | --- |\n| one<br>two | three |\n'
    )

    expect(saved).toContain('one<br>two')
    expect(saved).not.toContain('&lt;')
  })

  test('Should fail with the usage when a file is not named', () => {
    expect(() => execFileSync(process.execPath, [script], { stdio: 'pipe' }))
      .toThrow(/Usage: node scripts\/round-trip-markdown\.js/)
  })
})
