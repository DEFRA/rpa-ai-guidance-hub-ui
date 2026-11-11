import { guideSectionHref } from '../../../../src/pages/common/guide-section-href.js'

describe('guideSectionHref', () => {
  test('links to the guide, naming the section twice: for the page to show it on, and for the browser to go to', () => {
    expect(guideSectionHref('0199b8a2-4c1e-7b3a-9d2f-6a1e3c5b7d91', '1-pay'))
      .toBe('/guides/0199b8a2-4c1e-7b3a-9d2f-6a1e3c5b7d91?section=1-pay#1-pay')
  })

  test('encodes the guide and the section, so any heading\'s anchor survives the address', () => {
    expect(guideSectionHref('a/b', 'før_you-begin&more')).toBe('/guides/a%2Fb?section=f%C3%B8r_you-begin%26more#f%C3%B8r_you-begin%26more')
  })
})
