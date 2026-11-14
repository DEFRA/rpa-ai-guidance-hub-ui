import { getGuideFormat, GUIDE_FORMATS, setGuideFormat } from '../../../../src/pages/guide/format.js'

function requestWith (stored) {
  const store = new Map(stored === undefined ? [] : [['guide-format', stored]])

  return {
    yar: { get: key => store.get(key), set: (key, value) => store.set(key, value) }
  }
}

describe('guide format', () => {
  test('offers the whole guide, Traditional, and a section at a time, Stepper', () => {
    expect(GUIDE_FORMATS).toEqual([
      { value: 'traditional', text: 'Traditional' },
      { value: 'stepper', text: 'Stepper' }
    ])
  })

  test('is traditional until one is chosen', () => {
    expect(getGuideFormat(requestWith())).toBe('traditional')
  })

  test.each([['stepper'], ['traditional']])('remembers %s', (format) => {
    const request = requestWith()

    setGuideFormat(request, format)

    expect(getGuideFormat(request)).toBe(format)
  })

  test('ignores a stored value that is not an offered format', () => {
    expect(getGuideFormat(requestWith('scroll'))).toBe('traditional')
  })
})
