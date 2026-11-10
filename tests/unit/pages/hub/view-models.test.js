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

    test('Should return an empty bookmarkedGuides table', () => {
      expect(viewModel.bookmarkedGuides).toEqual(expect.objectContaining({
        heading: 'Bookmarked guides',
        isEmpty: true,
        count: 0,
        rows: []
      }))
    })

    test('Should return an empty list of recently opened guides, saying that any guide opened appears there', () => {
      expect(viewModel.recentlyOpened).toEqual(expect.objectContaining({
        heading: '0 recently opened guides',
        isGuideList: true,
        emptyMessage: "You haven't opened any guidance yet. Any guidance you open will appear here.",
        isEmpty: true,
        guides: []
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

    test('Should return an empty list of pinned guides, saying how to pin one', () => {
      expect(viewModel.pinned).toEqual(expect.objectContaining({
        heading: '0 pinned guides',
        showing: null,
        emptyMessage: "You haven't pinned any guidance yet. Select 'Pin guide' on a guide to add it here.",
        isGuideList: true,
        isEmpty: true,
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

  describe('bookmarkedGuides', () => {
    test('Should build a title/lastModified/version/action row, defaulting status to Published', () => {
      const viewModel = new HubViewModel({ bookmarkedGuides: [item] })

      expect(viewModel.bookmarkedGuides.rows).toEqual([[
        { type: 'title', text: item.title, href: item.href, statusText: 'Published', statusColour: 'green' },
        { type: 'text', text: item.lastModified },
        { type: 'version', version: item.version, colour: 'green' },
        { type: 'removeAction', text: item.title, href: item.removeHref }
      ]])
    })

    test('Should use a provided status over the Published default', () => {
      const viewModel = new HubViewModel({ bookmarkedGuides: [{ ...item, status: 'Archived' }] })

      expect(viewModel.bookmarkedGuides.rows[0][0]).toEqual(
        expect.objectContaining({ statusText: 'Archived', statusColour: 'green' })
      )
    })

    test.each([
      ['1', 'green'],
      ['0.5', 'green'],
      ['1.1', 'purple'],
      ['2', 'purple']
    ])('Should tag version %s as %s', (version, colour) => {
      const viewModel = new HubViewModel({ bookmarkedGuides: [{ ...item, version }] })

      expect(viewModel.bookmarkedGuides.rows[0][2]).toEqual({ type: 'version', version, colour })
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
      const viewModel = new HubViewModel({ bookmarkedGuides: [{ ...item, href, removeHref: href }] })

      expect(viewModel.bookmarkedGuides.rows[0][0].href).toBe('#')
      expect(viewModel.bookmarkedGuides.rows[0][3].href).toBe('#')
    })

    test('Should keep a same-origin relative href', () => {
      const viewModel = new HubViewModel({ bookmarkedGuides: [item] })

      expect(viewModel.bookmarkedGuides.rows[0][0].href).toBe(item.href)
      expect(viewModel.bookmarkedGuides.rows[0][3].href).toBe(item.removeHref)
    })
  })

  describe('allGuides', () => {
    const guide = {
      id: 'guide-1',
      pin: { pinned: true, position: 0 },
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
        id: 'guide-1',
        pin: { pinned: true, position: 0 },
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

    test('Should say that nothing matches when chosen filters leave no guides, and that there are none yet otherwise', () => {
      const filtered = new HubViewModel({ allGuides: [], filters: { selected: [{ text: 'CRM', href: '/hub' }] } })
      const unfiltered = new HubViewModel({ allGuides: [], filters: { selected: [] } })

      expect(filtered.allGuides.emptyMessage).toBe('No guides match your search or filters. Try removing some filters or using different search terms.')
      expect(unfiltered.allGuides.emptyMessage).toBe('There are no guides yet.')
    })

    test('Should not link to an untrusted href', () => {
      const { allGuides } = new HubViewModel({
        allGuides: [{ ...guide, href: 'javascript:alert(1)' }]
      })

      expect(allGuides.guides[0].href).toBe('#')
    })
  })

  describe('pinned', () => {
    const guide = {
      id: 'guide-1',
      pin: { pinned: true, position: 0 },
      title: 'Claiming the SFI payment',
      href: '/guides/guide-1',
      versionNumber: '2.1',
      purpose: 'Explain the claim.',
      lastUpdated: '20 July 2026',
      published: '1 July 2026'
    }

    test('Should list the pinned guides as the hub lists guides, counting them in its heading', () => {
      const { pinned } = new HubViewModel({ pinned: [guide, { ...guide, id: 'guide-2' }] })

      expect(pinned.heading).toBe('2 pinned guides')
      expect(pinned.showing).toBe('Showing 1 to 2')
      expect(pinned.guides[0]).toEqual(expect.objectContaining({ id: 'guide-1', pin: { pinned: true, position: 0 }, versionTag: { text: 'Version 2.1', colour: 'green' } }))
    })

    test('Should say one pinned guide in the singular', () => {
      expect(new HubViewModel({ pinned: [guide] }).pinned.heading).toBe('1 pinned guide')
    })

    test('Should say when chosen filters leave none of the pinned guides', () => {
      const { pinned } = new HubViewModel({ shown: 'pinned', filters: { selected: [{ text: 'CRM', href: '/hub/pinned' }] } })

      expect(pinned.emptyMessage).toBe('No guides match your search or filters. Try removing some filters or using different search terms.')
    })

    test('Should say nothing is pinned when chosen filters had nothing to narrow', () => {
      const { pinned } = new HubViewModel({
        shown: 'pinned',
        filters: { selected: [{ text: 'CRM', href: '/hub/pinned' }] },
        nothingToFilter: true
      })

      expect(pinned.emptyMessage).toBe("You haven't pinned any guidance yet. Select 'Pin guide' on a guide to add it here.")
    })
  })

  describe('recentlyOpened', () => {
    const guide = {
      id: 'guide-1',
      pin: { pinned: false, position: null },
      title: 'Claiming the SFI payment',
      href: '/guides/guide-1',
      versionNumber: '2.1',
      purpose: 'Explain the claim.',
      lastUpdated: '20 July 2026',
      published: '1 July 2026'
    }

    test('Should list the recently opened guides as the hub lists guides, counting them in its heading', () => {
      const { recentlyOpened } = new HubViewModel({ recentlyOpened: [guide, { ...guide, id: 'guide-2' }] })

      expect(recentlyOpened.heading).toBe('2 recently opened guides')
      expect(recentlyOpened.showing).toBe('Showing 1 to 2')
      expect(recentlyOpened.guides.map(row => row.id)).toEqual(['guide-1', 'guide-2'])
    })

    test('Should say one recently opened guide in the singular', () => {
      expect(new HubViewModel({ recentlyOpened: [guide] }).recentlyOpened.heading).toBe('1 recently opened guide')
    })

    test('Should say when chosen filters leave none of the recently opened guides', () => {
      const { recentlyOpened } = new HubViewModel({ shown: 'recentlyOpened', filters: { selected: [{ text: 'CRM', href: '/hub/recently-opened' }] } })

      expect(recentlyOpened.emptyMessage).toBe('No guides match your search or filters. Try removing some filters or using different search terms.')
    })

    test('Should say none has been opened when chosen filters had nothing to narrow', () => {
      const { recentlyOpened } = new HubViewModel({
        shown: 'recentlyOpened',
        filters: { selected: [{ text: 'CRM', href: '/hub/recently-opened' }] },
        nothingToFilter: true
      })

      expect(recentlyOpened.emptyMessage).toBe("You haven't opened any guidance yet. Any guidance you open will appear here.")
    })
  })
})

describe('HubViewModel search', () => {
  const GUIDE = '7c9e6679-7425-40de-944b-e07fc1f90ae7'
  const result = {
    title: '4.2 Claim rules',
    href: '/guides/g-1#claim-rules',
    documentTitle: 'CS final payments',
    matches: 1,
    snippet: [{ text: 'claim', match: true }]
  }
  const guide = {
    id: GUIDE,
    title: 'CS final payments',
    href: `/guides/${GUIDE}`,
    sectionTotal: 1,
    sections: [result]
  }

  function searched (found, page = 1, inside = null) {
    return new HubViewModel({ words: 'claim', search: { words: 'claim', page, guide: inside, found: { unavailable: false, tooManyMatches: false, sectionTotal: 0, ...found } } })
  }

  test('has no search when nothing was searched for', () => {
    const viewModel = new HubViewModel()

    expect(viewModel.search).toBeNull()
    expect(viewModel.searchUnavailable).toBe(false)
  })

  describe('across every guide', () => {
    test('counts the guides and their sections, and shows each guide with its sections', () => {
      const viewModel = searched({ total: 1, sectionTotal: 1, results: [guide] })

      expect(viewModel.search).toEqual({
        words: 'claim',
        heading: '1 guide',
        summary: '1 section with these words',
        backLink: null,
        emptyMessage: null,
        guides: [{
          title: 'CS final payments',
          href: `/guides/${GUIDE}`,
          hint: '1 section with these words',
          sections: [{ title: '4.2 Claim rules', href: '/guides/g-1#claim-rules', hint: '1 match', snippet: [{ text: 'claim', match: true }] }],
          more: null
        }],
        results: [],
        pagination: null
      })
    })

    test('counts in the plural, and pages by guide', () => {
      const viewModel = searched({ total: 12, sectionTotal: 40, results: [{ ...guide, sectionTotal: 3, sections: [{ ...result, matches: 3 }] }] })

      expect(viewModel.search.heading).toBe('12 guides')
      expect(viewModel.search.summary).toBe('40 sections with these words')
      expect(viewModel.search.guides[0].sections[0].hint).toBe('3 matches')
      expect(viewModel.search.pagination.next).toEqual({ href: '/hub?q=claim&page=2' })
    })

    test('links to every section of a guide that has more than it shows', () => {
      const viewModel = searched({ total: 1, sectionTotal: 25, results: [{ ...guide, sectionTotal: 25 }] })

      expect(viewModel.search.guides[0].more).toEqual({
        href: `/hub?q=claim&guide=${GUIDE}`,
        text: 'See all 25 sections in this guide'
      })
    })

    test('makes each guide\'s and section\'s link safe', () => {
      const viewModel = searched({ total: 1, results: [{ ...guide, href: 'javascript:alert(1)', sections: [{ ...result, href: 'javascript:alert(1)' }] }] })

      expect(viewModel.search.guides[0].href).toBe('#')
      expect(viewModel.search.guides[0].sections[0].href).toBe('#')
    })

    test('says when no guide has the words', () => {
      const viewModel = searched({ total: 0, results: [] })

      expect(viewModel.search.emptyMessage).toBe('No guides have the words “claim”. Check the spelling or try fewer words.')
      expect(viewModel.search.summary).toBeNull()
    })

    test('says when there are too many matches, showing none', () => {
      const viewModel = searched({ total: 0, sectionTotal: 1500, tooManyMatches: true, results: [] })

      expect(viewModel.search.emptyMessage).toBe('Too many matches. Use more specific words.')
      expect(viewModel.search.pagination).toBeNull()
    })

    test('says when the page asked for is beyond the results', () => {
      const viewModel = searched({ total: 5, results: [] }, 4)

      expect(viewModel.search.emptyMessage).toBe('There is no page 4 of results.')
    })
  })

  describe('inside one guide', () => {
    test('counts its sections, names it, and links back to every guide', () => {
      const viewModel = searched({ total: 1, results: [result] }, 1, GUIDE)

      expect(viewModel.search).toEqual({
        words: 'claim',
        heading: '1 section',
        summary: 'In CS final payments',
        backLink: { href: '/hub?q=claim', text: 'All guides with these words' },
        emptyMessage: null,
        guides: [],
        results: [{ title: '4.2 Claim rules', href: '/guides/g-1#claim-rules', hint: '1 match', snippet: [{ text: 'claim', match: true }] }],
        pagination: null
      })
    })

    test('pages its sections, keeping the guide', () => {
      const viewModel = searched({ total: 25, results: [result] }, 1, GUIDE)

      expect(viewModel.search.heading).toBe('25 sections')
      expect(viewModel.search.pagination.next).toEqual({ href: `/hub?q=claim&guide=${GUIDE}&page=2` })
    })

    test('says when the guide has no sections with the words', () => {
      const viewModel = searched({ total: 0, results: [] }, 1, GUIDE)

      expect(viewModel.search.emptyMessage).toBe('This guide has no sections with the words “claim”.')
      expect(viewModel.search.summary).toBeNull()
    })
  })

  test('says when search is unavailable', () => {
    const viewModel = new HubViewModel({ searchUnavailable: true })

    expect(viewModel.searchUnavailable).toBe(true)
  })
})
