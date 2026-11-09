import { bookmarkedToHtml, headingBookmarkHtml, headingControlsHtml, headingPinHtml } from '../../../src/constants/heading-bookmarks.js'

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

describe('headingPinHtml', () => {
  const GUIDE = '0199b8a2-4c1e-7b3a-9d2f-6a1e3c5b7d90'

  test('pins the heading\'s section by its anchor, its star named for the heading, escaping both', () => {
    const html = headingPinHtml({ guideId: GUIDE, section: 'a"b', anchor: 'a-b-1', returnTo: '/guides/g?page=1&x=1', pinned: null }, '<Pay> & claim')

    expect(html).toMatch(/^<form class="app-guide-section-pin" method="post" action="\/pin-toggle">/)
    expect(html).toContain(`<input type="hidden" name="guideId" value="${GUIDE}">`)
    expect(html).toContain('<input type="hidden" name="pin" value="true">')
    expect(html).toContain('<input type="hidden" name="section" value="a&quot;b">')
    expect(html).toContain('<input type="hidden" name="anchor" value="a-b-1">')
    expect(html).toContain('<input type="hidden" name="returnTo" value="/guides/g?page=1&amp;x=1">')
    expect(html).not.toContain('name="position"')
    expect(html).not.toContain('fill="currentColor"')
    expect(html).toContain('<span class="govuk-visually-hidden">Pin section: &lt;Pay&gt; &amp; claim</span>')
  })

  test('once pinned, is filled and unpins the section from where the user\'s pins have it', () => {
    const pinned = { position: 2, sectionId: 'section-1', key: `${GUIDE}/section-1` }

    const html = headingPinHtml({ guideId: GUIDE, section: 'pay', returnTo: '/g', pinned }, 'Pay')

    expect(html).toContain(`data-reorder-follows="${GUIDE}/section-1"`)
    expect(html).toContain('<input type="hidden" name="pin" value="false">')
    expect(html).toContain('<input type="hidden" name="position" value="2">')
    expect(html).toContain('<input type="hidden" name="sectionId" value="section-1">')
    expect(html).toContain('fill="currentColor"')
    expect(html).toContain('Unpin section: Pay')
  })
})

describe('headingControlsHtml', () => {
  const bookmark = { href: '/guides/g/bookmark?section=pay', bookmarkedTo: null }

  test('puts the star before the bookmark', () => {
    const html = headingControlsHtml({ ...bookmark, pin: { guideId: 'g', section: 'pay', returnTo: '/g', pinned: null } }, 'Pay')

    expect(html.indexOf('app-guide-section-pin')).toBeGreaterThan(-1)
    expect(html.indexOf('app-guide-section-bookmark')).toBeGreaterThan(html.indexOf('app-guide-section-pin'))
  })

  test('has no star when the user\'s pins are not known', () => {
    const html = headingControlsHtml({ ...bookmark, pin: null }, 'Pay')

    expect(html).toBe(headingBookmarkHtml(bookmark, 'Pay'))
  })
})

describe('bookmarkedToHtml', () => {
  test('says which cases the heading is bookmarked to, or nothing', () => {
    expect(bookmarkedToHtml({ bookmarkedTo: 'Case W1234567' })).toBe('<p class="app-guide-section-bookmarked">Bookmarked to Case W1234567</p>')
    expect(bookmarkedToHtml({ bookmarkedTo: null })).toBe('')
  })
})
