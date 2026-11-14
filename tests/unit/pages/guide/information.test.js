import { isInformationShown, setInformationShown } from '../../../../src/pages/guide/information.js'

function createRequest (stored) {
  const store = new Map(stored === undefined ? [] : [['guide-information-shown', stored]])

  return {
    yar: { get: key => store.get(key), set: (key, value) => store.set(key, value) }
  }
}

describe('a guide\'s information', () => {
  test('is hidden until the user shows it', () => {
    expect(isInformationShown(createRequest())).toBe(false)
  })

  test.each([[true], [false]])('remembers shown as %s, for every guide', (shown) => {
    const request = createRequest()

    setInformationShown(request, shown)

    expect(isInformationShown(request)).toBe(shown)
  })

  test('is hidden for anything stored other than true', () => {
    expect(isInformationShown(createRequest('true'))).toBe(false)
  })
})
