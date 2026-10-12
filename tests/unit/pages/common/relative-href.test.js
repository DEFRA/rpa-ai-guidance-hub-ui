import { relativeHref } from '../../../../src/pages/common/relative-href.js'

describe('relativeHref', () => {
  test.each([
    ['/hub'],
    ['/hub#all-guides'],
    ['/guides/1?page=2&from=%2Fhub']
  ])('keeps the same-origin path %s', (href) => {
    expect(relativeHref(href)).toBe(href)
  })

  test.each([
    ['javascript:alert(1)'],
    ['https://evil.example'],
    ['//evil.example'],
    ['/\\evil.example'],
    ['/\n/evil.example'],
    ['//['],
    ['relative/path'],
    [undefined],
    [null],
    [42]
  ])('replaces %j with the fallback', (href) => {
    expect(relativeHref(href)).toBe('#')
    expect(relativeHref(href, '/hub')).toBe('/hub')
  })
})
