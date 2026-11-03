import { HubViewModel } from '../../../../src/pages/hub/view-models.js'

const item = {
  title: 'CS MA Claim - Revenue Options Claim Rule at Signoff 2026',
  href: '/guidance/1',
  lastModified: '20 July 2026',
  version: '1',
  removeHref: '/hub/remove/1'
}

describe('#HubViewModel', () => {
  describe('when no guidance is provided', () => {
    const viewModel = new HubViewModel()

    test.each([
      ['recentlyOpened', 'Recently opened'],
      ['pinned', 'Pinned'],
      ['bookmarkedGuides', 'Bookmarked guides']
    ])('Should return an empty %s table', (key, heading) => {
      expect(viewModel[key]).toEqual(expect.objectContaining({
        heading,
        isEmpty: true,
        count: 0,
        rows: []
      }))
    })

    test('Should return an empty list of all guides, counted, with nothing showing', () => {
      expect(viewModel.allGuides).toEqual(expect.objectContaining({
        heading: '0 guides',
        showing: null,
        emptyMessage: 'There are no guides yet.',
        isGuideList: true,
        isEmpty: true,
        count: 0,
        guides: []
      }))
    })

    test('has no list awaiting review', () => {
      expect(viewModel.awaitingMyReview).toBeUndefined()
    })

    test('Should have no list of guidance being edited', () => {
      expect(viewModel.editing).toBeUndefined()
    })
  })

  describe('recentlyOpened, pinned and bookmarkedGuides', () => {
    test('Should build a title/lastModified/version/action row, defaulting status to Published', () => {
      const viewModel = new HubViewModel({ recentlyOpened: [item] })

      expect(viewModel.recentlyOpened.rows).toEqual([[
        { type: 'title', text: item.title, href: item.href, statusText: 'Published', statusColour: 'green' },
        { type: 'text', text: item.lastModified },
        { type: 'version', version: item.version, colour: 'green' },
        { type: 'removeAction', text: item.title, href: item.removeHref }
      ]])
    })

    test('Should use a provided status over the Published default', () => {
      const viewModel = new HubViewModel({ pinned: [{ ...item, status: 'Archived' }] })

      expect(viewModel.pinned.rows[0][0]).toEqual(
        expect.objectContaining({ statusText: 'Archived', statusColour: 'green' })
      )
    })

    test('Should build bookmarked guides rows as it does pinned ones', () => {
      const viewModel = new HubViewModel({ pinned: [item], bookmarkedGuides: [item] })

      expect(viewModel.bookmarkedGuides.rows).toEqual(viewModel.pinned.rows)
    })

    test('Should count the recently opened items into the hint message', () => {
      const viewModel = new HubViewModel({ recentlyOpened: [item, item] })

      expect(viewModel.recentlyOpened.hintMessage).toBe('Your 2 recently opened guidances')
    })

    test.each([
      ['1', 'green'],
      ['0.5', 'green'],
      ['1.1', 'purple'],
      ['2', 'purple']
    ])('Should tag version %s as %s', (version, colour) => {
      const viewModel = new HubViewModel({ recentlyOpened: [{ ...item, version }] })

      expect(viewModel.recentlyOpened.rows[0][2]).toEqual({ type: 'version', version, colour })
    })
  })

  describe('untrusted hrefs', () => {
    test.each([
      ['javascript: URI', 'javascript:alert(document.cookie)'],
      ['data: URI', 'data:text/html,<script>alert(1)</script>'],
      ['protocol-relative URL', '//evil.example.com'],
      ['backslash protocol-relative URL', '/\\evil.example.com'],
      ['newline protocol-relative URL', '/\n/evil.example.com'],
      ['carriage return protocol-relative URL', '/\r/evil.example.com'],
      ['tab protocol-relative URL', '/\t/evil.example.com'],
      ['unparseable URL', '//['],
      ['absolute URL', 'https://evil.example.com'],
      ['missing href', undefined]
    ])('Should replace a %s href with "#"', (_, href) => {
      const viewModel = new HubViewModel({ recentlyOpened: [{ ...item, href, removeHref: href }] })

      expect(viewModel.recentlyOpened.rows[0][0].href).toBe('#')
      expect(viewModel.recentlyOpened.rows[0][3].href).toBe('#')
    })

    test('Should keep a same-origin relative href', () => {
      const viewModel = new HubViewModel({ recentlyOpened: [item] })

      expect(viewModel.recentlyOpened.rows[0][0].href).toBe(item.href)
      expect(viewModel.recentlyOpened.rows[0][3].href).toBe(item.removeHref)
    })
  })

  describe('allGuides', () => {
    const guide = {
      title: 'Claiming the SFI payment',
      href: '/guides/guide-1',
      versionNumber: '2.1',
      purpose: 'Explain the claim.',
      lastUpdated: '20 July 2026',
      published: '1 July 2026'
    }

    test('Should give each guide a row: its version, title and link, purpose, and when it was last updated and published', () => {
      const { allGuides } = new HubViewModel({ allGuides: [guide] })

      expect(allGuides.count).toBe(1)
      expect(allGuides.isEmpty).toBe(false)
      expect(allGuides.guides).toEqual([{
        title: 'Claiming the SFI payment',
        href: '/guides/guide-1',
        versionTag: { text: 'Version 2.1', colour: 'green' },
        purpose: 'Explain the claim.',
        lastUpdated: '20 July 2026',
        published: '1 July 2026'
      }])
    })

    test('Should tag no version for a guide whose version has no number', () => {
      const { allGuides } = new HubViewModel({ allGuides: [{ ...guide, versionNumber: null }] })

      expect(allGuides.guides[0].versionTag).toBeNull()
    })

    test.each([
      [1, '1 guide', 'Showing 1 to 1'],
      [3, '3 guides', 'Showing 1 to 3']
    ])('Should head a list of %i with how many guides it has, and say which it is showing', (count, heading, showing) => {
      const { allGuides } = new HubViewModel({ allGuides: new Array(count).fill(guide) })

      expect(allGuides.heading).toBe(heading)
      expect(allGuides.showing).toBe(showing)
    })

    test('Should not link to an untrusted href', () => {
      const { allGuides } = new HubViewModel({
        allGuides: [{ ...guide, href: 'javascript:alert(1)' }]
      })

      expect(allGuides.guides[0].href).toBe('#')
    })
  })
})
