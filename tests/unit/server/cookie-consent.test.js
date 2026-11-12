import {
  parseConsent,
  safeReturnPath,
  serializeConsent
} from '../../../src/server/cookie-consent.js'

test('parseConsent reads an accepted choice back', () => {
  expect(parseConsent(serializeConsent(true))).toBe(true)
})

test('parseConsent reads a rejected choice back', () => {
  expect(parseConsent(serializeConsent(false))).toBe(false)
})

test.each([
  ['no cookie', undefined],
  ['a malformed escape', '%E0%A4%A'],
  ['a value that is not JSON', 'not json']
])('parseConsent does not accept analytics for %s', (_name, value) => {
  expect(parseConsent(value)).toBe(false)
})

test('safeReturnPath keeps a local path with its query', () => {
  expect(safeReturnPath('/guides?page=2')).toBe('/guides?page=2')
})

test('safeReturnPath drops a previous cookieAction', () => {
  expect(safeReturnPath('/guides?a=1&cookieAction=accept'))
    .toBe('/guides?a=1')
})

test.each([
  ['a protocol-relative URL', '//evil.example'],
  ['a backslash host', '/\\evil.example'],
  ['an absolute URL', 'https://evil.example'],
  ['nothing', undefined],
  ['an empty string', '']
])('safeReturnPath sends %s to the home page', (_name, value) => {
  expect(safeReturnPath(value)).toBe('/')
})
