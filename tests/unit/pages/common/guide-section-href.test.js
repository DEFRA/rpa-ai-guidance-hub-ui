import { guideSectionHref } from '../../../../src/pages/common/guide-section-href.js'

describe('guideSectionHref', () => {
  test('links to the guide, naming the section twice: for the page to show it on, and for the browser to go to', () => {
    expect(guideSectionHref('0199b8a2-4c1e-7b3a-9d2f-6a1e3c5b7d91', '1-pay'))
      .toBe('/guides/0199b8a2-4c1e-7b3a-9d2f-6a1e3c5b7d91?section=1-pay#1-pay')
  })

  test('encodes the guide and the section, so any heading\'s anchor survives the address', () => {
    expect(guideSectionHref('a/b', 'før_you-begin&more')).toBe('/guides/a%2Fb?section=f%C3%B8r_you-begin%26more#f%C3%B8r_you-begin%26more')
  })

  test('goes to the heading\'s own anchor on the page, when it is not the hub\'s', () => {
    expect(guideSectionHref('g-1', 'pay', { slug: 'pay-2' })).toBe('/guides/g-1?section=pay#pay-2')
  })

  test('keeps words searched for, for the guide to search them again', () => {
    expect(guideSectionHref('g-1', '1-pay', { words: 'claim & pay' })).toBe('/guides/g-1?section=1-pay&q=claim%20%26%20pay#1-pay')
  })
})
