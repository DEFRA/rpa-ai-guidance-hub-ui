import {
  getConsent,
  isConsentSet,
  safeReturnPath,
  setConsent
} from '../../../src/server/cookie-consent.js'

function fakeResponse () {
  const response = {
    state: vi.fn(() => response),
    unstate: vi.fn(() => response)
  }
  return response
}

test('getConsent reads an accepted choice back', () => {
  const response = fakeResponse()
  setConsent({}, response, true)
  const [, value] = response.state.mock.calls[0]

  expect(getConsent({ state: { defra_cookies_policy: value } })).toBe(true)
})

test('getConsent reads a rejected choice back', () => {
  const response = fakeResponse()
  setConsent({}, response, false)
  const [, value] = response.state.mock.calls[0]

  expect(getConsent({ state: { defra_cookies_policy: value } })).toBe(false)
})

test.each([
  ['no request', undefined],
  ['no cookie', { state: {} }],
  ['a malformed escape', { state: { defra_cookies_policy: '%E0%A4%A' } }],
  ['a value that is not JSON', { state: { defra_cookies_policy: 'not json' } }]
])('getConsent does not accept analytics for %s', (_name, request) => {
  expect(getConsent(request)).toBe(false)
})

test('isConsentSet is true only once the choice has been recorded', () => {
  expect(isConsentSet({ state: { defra_cookies_policy_set: 'true' } })).toBe(true)
  expect(isConsentSet({ state: {} })).toBe(false)
  expect(isConsentSet(undefined)).toBe(false)
})

test('setConsent records the choice and that one was made', () => {
  const response = fakeResponse()

  expect(setConsent({}, response, true)).toBe(response)
  expect(response.state).toHaveBeenCalledWith(
    'defra_cookies_policy', '%7B%22analytics%22%3Atrue%7D')
  expect(response.state).toHaveBeenCalledWith('defra_cookies_policy_set', 'true')
  expect(response.unstate).not.toHaveBeenCalled()
})

test('setConsent rejecting drops Google Analytics cookies and no others', () => {
  const response = fakeResponse()

  setConsent({ state: { _ga: '1', _ga_ABC: '2', other: '3' } }, response, false)

  expect(response.unstate).toHaveBeenCalledTimes(2)
  expect(response.unstate).toHaveBeenCalledWith('_ga', { path: '/' })
  expect(response.unstate).toHaveBeenCalledWith('_ga_ABC', { path: '/' })
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
