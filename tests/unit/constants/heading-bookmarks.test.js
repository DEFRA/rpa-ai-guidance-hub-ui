import { bookmarkedToHtml, headingBookmarkHtml } from '../../../src/constants/heading-bookmarks.js'

describe('headingBookmarkHtml', () => {
  test('names the control for its heading, escaping both', () => {
    const html = headingBookmarkHtml({ href: '/guides/g/bookmark?section=a&b', bookmarkedTo: null }, '<Pay> & claim')

    expect(html).toContain('href="/guides/g/bookmark?section=a&amp;b"')
    expect(html).toContain('<span class="govuk-visually-hidden">Bookmark to a case: &lt;Pay&gt; &amp; claim</span>')
  })

  test('fills the icon, and offers another case, once the heading is bookmarked', () => {
    const html = headingBookmarkHtml({ href: '/b', bookmarkedTo: 'Case W1234567' }, 'Pay')

    expect(html).toContain('app-guide-section-bookmark--active')
    expect(html).toContain('fill="currentColor"')
    expect(html).toContain('Bookmarked – add another case: Pay')
  })
})

describe('bookmarkedToHtml', () => {
  test('says which cases the heading is bookmarked to, or nothing', () => {
    expect(bookmarkedToHtml({ bookmarkedTo: 'Case W1234567' })).toBe('<p class="app-guide-section-bookmarked">Bookmarked to Case W1234567</p>')
    expect(bookmarkedToHtml({ bookmarkedTo: null })).toBe('')
  })
})
