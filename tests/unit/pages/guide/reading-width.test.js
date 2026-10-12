import {
  getReadingWidth,
  isReadingWidth,
  setReadingWidth
} from '../../../../src/pages/guide/reading-width.js'

function requestWith (stored) {
  const store = new Map(stored === undefined ? [] : [['guide-reading-width', stored]])

  return {
    yar: { get: key => store.get(key), set: (key, value) => store.set(key, value) }
  }
}

describe('reading width', () => {
  test('is standard until one is chosen', () => {
    expect(getReadingWidth(requestWith())).toBe('standard')
  })

  test.each([['standard'], ['wide'], ['full']])('remembers %s', (width) => {
    const request = requestWith()

    setReadingWidth(request, width)

    expect(getReadingWidth(request)).toBe(width)
  })

  test('ignores a stored value that is not an offered width', () => {
    expect(getReadingWidth(requestWith('huge'))).toBe('standard')
  })

  test.each([['wide', true], ['huge', false], [undefined, false]])('isReadingWidth(%j) is %s', (width, expected) => {
    expect(isReadingWidth(width)).toBe(expected)
  })
})
