import { HubViewModel } from '../../../../src/pages/hub/view-models.js'
import { HUB_MESSAGES } from '../../../fixtures/messages.js'

describe('#HubViewModel', () => {
  describe('when no guidance is provided', () => {
    const viewModel = new HubViewModel()

    test('Should return an empty list of bookmarked guides, saying how to bookmark one', () => {
      expect(viewModel.bookmarkedGuides).toEqual(expect.objectContaining({
        heading: '0 bookmarked guides',
        isGuideList: true,
        emptyHtml: HUB_MESSAGES.noneBookmarked,
        isEmpty: true,
        guides: []
      }))
    })

    test('Should return an empty list of recently opened guides, saying that any guide opened appears there', () => {
      expect(viewModel.recentlyOpened).toEqual(expect.objectContaining({
        heading: '0 recently opened guides',
        isGuideList: true,
        emptyHtml: HUB_MESSAGES.noneOpened,
        isEmpty: true,
        guides: []
      }))
    })

    test('Should return an empty list of all guides, counted, with nothing showing', () => {
      expect(viewModel.allGuides).toEqual(expect.objectContaining({
        heading: '0 guides',
        showing: null,
        emptyHtml: HUB_MESSAGES.noGuides,
        isGuideList: true,
        isEmpty: true,
        count: 0,
        guides: []
      }))
    })

    test('Should return an empty list of pinned guides, saying how to pin one', () => {
      expect(viewModel.pinned).toEqual(expect.objectContaining({
        heading: '0 pins',
        showing: null,
        emptyHtml: HUB_MESSAGES.nonePinned,
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

    test('Should list the bookmarked guides as the hub lists guides, counting them in its heading', () => {
      const { bookmarkedGuides } = new HubViewModel({ bookmarkedGuides: [guide, { ...guide, id: 'guide-2' }] })

      expect(bookmarkedGuides.heading).toBe('2 bookmarked guides')
      expect(bookmarkedGuides.showing).toBe('Showing 1 to 2')
      expect(bookmarkedGuides.guides.map(row => row.id)).toEqual(['guide-1', 'guide-2'])
    })

    test('Should name the case in the heading of bookmarked guides narrowed to one', () => {
      const { bookmarkedGuides } = new HubViewModel({ bookmarkedGuides: [guide], narrowedTo: { key: 'key-1', text: 'Case: W1234567' } })

      expect(bookmarkedGuides.heading).toBe('1 bookmarked guide for Case: W1234567')
    })

    test('Should not name the case in the heading of any other list', () => {
      const { pinned } = new HubViewModel({ pinned: [guide], narrowedTo: { key: 'key-1', text: 'Case: W1234567' } })

      expect(pinned.heading).toBe('1 pin')
    })

    test('Should say one bookmarked guide in the singular', () => {
      expect(new HubViewModel({ bookmarkedGuides: [guide] }).bookmarkedGuides.heading).toBe('1 bookmarked guide')
    })

    test('Should say when chosen filters leave none of the bookmarked guides', () => {
      const { bookmarkedGuides } = new HubViewModel({ shown: 'bookmarkedGuides', filters: { selected: [{ text: 'CRM', href: '/hub/bookmarked-guides' }] } })

      expect(bookmarkedGuides.emptyHtml).toBe(HUB_MESSAGES.noneMatch)
    })

    test('Should say nothing is bookmarked when chosen filters had nothing to narrow', () => {
      const { bookmarkedGuides } = new HubViewModel({
        shown: 'bookmarkedGuides',
        filters: { selected: [{ text: 'CRM', href: '/hub/bookmarked-guides' }] },
        nothingToFilter: true
      })

      expect(bookmarkedGuides.emptyHtml).toBe(HUB_MESSAGES.noneBookmarked)
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
        const { bookmarkedGuides } = new HubViewModel({ bookmarkedGuides: [{ ...guide, href }] })

        expect(bookmarkedGuides.guides[0].href).toBe('#')
      })

      test('Should keep a same-origin relative href', () => {
        expect(new HubViewModel({ bookmarkedGuides: [guide] }).bookmarkedGuides.guides[0].href).toBe('/guides/guide-1')
      })
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

      expect(filtered.allGuides.emptyHtml).toBe(HUB_MESSAGES.noneMatch)
      expect(unfiltered.allGuides.emptyHtml).toBe(HUB_MESSAGES.noGuides)
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

    test('Should list the pins as the hub lists guides, counting them in its heading', () => {
      const { pinned } = new HubViewModel({ pinned: [guide, { ...guide, id: 'guide-2' }] })

      expect(pinned.heading).toBe('2 pins')
      expect(pinned.showing).toBe('Showing 1 to 2')
      expect(pinned.guides[0]).toEqual(expect.objectContaining({ id: 'guide-1', pin: { pinned: true, position: 0 }, versionTag: { text: 'Version 2.1', colour: 'green' } }))
    })

    test('Should say one pin in the singular', () => {
      expect(new HubViewModel({ pinned: [guide] }).pinned.heading).toBe('1 pin')
    })

    test('Should say when chosen filters leave none of the pinned guides', () => {
      const { pinned } = new HubViewModel({ shown: 'pinned', filters: { selected: [{ text: 'CRM', href: '/hub/pinned' }] } })

      expect(pinned.emptyHtml).toBe(HUB_MESSAGES.noneMatch)
    })

    test('Should say nothing is pinned when chosen filters had nothing to narrow', () => {
      const { pinned } = new HubViewModel({
        shown: 'pinned',
        filters: { selected: [{ text: 'CRM', href: '/hub/pinned' }] },
        nothingToFilter: true
      })

      expect(pinned.emptyHtml).toBe(HUB_MESSAGES.nonePinned)
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

      expect(recentlyOpened.emptyHtml).toBe(HUB_MESSAGES.noneMatch)
    })

    test('Should say none has been opened when chosen filters had nothing to narrow', () => {
      const { recentlyOpened } = new HubViewModel({
        shown: 'recentlyOpened',
        filters: { selected: [{ text: 'CRM', href: '/hub/recently-opened' }] },
        nothingToFilter: true
      })

      expect(recentlyOpened.emptyHtml).toBe(HUB_MESSAGES.noneOpened)
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
    titleSnippet: null,
    sectionTotal: 1,
    sections: [result]
  }

  /**
   * A guide whose title the words cover.
   *
   * @param {number} [number=1] - Which, so each has a title and id of its own
   * @param {Object} [overrides]
   * @returns {Object}
   */
  function titled (number = 1, overrides = {}) {
    const title = `CS MA Claim - Case ${number}`

    return {
      id: `t-${number}`,
      title,
      href: `/guides/t-${number}`,
      titleSnippet: [{ text: 'CS MA Claim', match: true }, { text: ` - Case ${number}`, match: false }],
      sectionTotal: 0,
      sections: [],
      ...overrides
    }
  }

  function searched (found, page = 1, inside = null, promotedPurpose = null) {
    return new HubViewModel({
      words: 'claim',
      search: {
        words: 'claim',
        page,
        guide: inside,
        promotedPurpose,
        found: { unavailable: false, tooManyMatches: false, sectionTotal: 0, documentTotal: found.total, titles: [], ...found }
      }
    })
  }

  test('has no search when nothing was searched for', () => {
    const viewModel = new HubViewModel()

    expect(viewModel.search).toBeNull()
    expect(viewModel.searchUnavailable).toBe(false)
    expect(viewModel.wordsTooLong).toBe(false)
  })

  describe('across every guide', () => {
    test('counts the guides and their sections, and shows each guide with its sections', () => {
      const viewModel = searched({ total: 1, sectionTotal: 1, results: [guide] })

      expect(viewModel.search).toEqual({
        words: 'claim',
        heading: '1 guide',
        summary: '1 match',
        backLink: null,
        emptyMessage: null,
        noResults: null,
        titleBlock: null,
        listHeading: null,
        listEmpty: null,
        guideHeadingLevel: 3,
        guides: [{
          title: 'CS final payments',
          titleSnippet: null,
          href: `/guides/${GUIDE}`,
          hint: '1 match',
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
      expect(viewModel.search.summary).toBe('40 matches')
      expect(viewModel.search.guides[0].sections[0].hint).toBe('3 matches')
      expect(viewModel.search.pagination.next).toEqual({ href: '/hub?q=claim&page=2' })
    })

    test('links to every section of a guide that has more than it shows', () => {
      const viewModel = searched({ total: 1, sectionTotal: 25, results: [{ ...guide, sectionTotal: 25 }] })

      expect(viewModel.search.guides[0].more).toEqual({
        href: `/hub?q=claim&guide=${GUIDE}`,
        text: 'See all 25 matches in this guide'
      })
    })

    test('makes each guide\'s and section\'s link safe', () => {
      const viewModel = searched({ total: 1, results: [{ ...guide, href: 'javascript:alert(1)', sections: [{ ...result, href: 'javascript:alert(1)' }] }] })

      expect(viewModel.search.guides[0].href).toBe('#')
      expect(viewModel.search.guides[0].sections[0].href).toBe('#')
    })

    test('says when nothing has the words, with what to try next', () => {
      const viewModel = searched({ total: 0, results: [] })

      expect(viewModel.search.noResults).toEqual({ heading: 'There are no guides with ‘claim’' })
      expect(viewModel.search.emptyMessage).toBeNull()
      expect(viewModel.search.summary).toBeNull()
      expect(viewModel.search.titleBlock).toBeNull()
    })

    test('says there is no such page when the page asked for is beyond the guides, rather than that nothing has the words', () => {
      const viewModel = searched({ total: 0, documentTotal: 1, titles: [titled()], results: [] }, 2)

      expect(viewModel.search.noResults).toBeNull()
      expect(viewModel.search.emptyMessage).toBe('There is no page 2 of results.')
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

  describe('with the one guide whose title the words cover', () => {
    test('promotes it above the guides, with what it is for and its sections that have them', () => {
      const promoted = titled(1, { sectionTotal: 2, sections: [result, { ...result, title: '2 Assign case', href: '/guides/t-1#assign-case' }] })
      const viewModel = searched({ total: 2, documentTotal: 2, sectionTotal: 3, titles: [promoted], results: [promoted, guide] }, 1, null, 'Check a claim\'s weight.')

      expect(viewModel.search.heading).toBe('2 guides')
      expect(viewModel.search.titleBlock).toEqual({
        kind: 'strong',
        title: 'CS MA Claim - Case 1',
        titleSnippet: promoted.titleSnippet,
        href: '/guides/t-1',
        purpose: 'Check a claim\'s weight.',
        alsoFound: [
          { title: '4.2 Claim rules', href: '/guides/g-1#claim-rules' },
          { title: '2 Assign case', href: '/guides/t-1#assign-case' }
        ]
      })
      expect(viewModel.search.listHeading).toBe('Sections that mention ‘claim’')
      expect(viewModel.search.guideHeadingLevel).toBe(4)
    })

    test('lists it among the guides too, with a link to every one of its sections, as the search service gives it in both', () => {
      const promoted = titled(1, { sectionTotal: 5, sections: [result] })
      const viewModel = searched({ total: 1, documentTotal: 1, sectionTotal: 5, titles: [promoted], results: [promoted] })

      expect(viewModel.search.titleBlock.kind).toBe('strong')
      expect(viewModel.search.guides.map((group) => group.title)).toEqual(['CS MA Claim - Case 1'])
      expect(viewModel.search.guides[0].more).toEqual({ href: '/hub?q=claim&guide=t-1', text: 'See all 5 matches in this guide' })
      expect(viewModel.search.listEmpty).toBeNull()
    })

    test('lists it on the later page its sections rank it on, with every page of guides counted', () => {
      const promoted = titled(1, { sectionTotal: 1, sections: [result] })
      const viewModel = searched({ total: 11, documentTotal: 11, sectionTotal: 11, titles: [promoted], results: [promoted] }, 2)

      expect(viewModel.search.titleBlock).toBeNull()
      expect(viewModel.search.guides.map((group) => group.title)).toEqual(['CS MA Claim - Case 1'])
      expect(viewModel.search.pagination.items.map((item) => item.number)).toEqual([1, 2])
    })

    test('says, under the heading over the guides, that no sections mention the words when only its title has them', () => {
      const viewModel = searched({ total: 0, documentTotal: 1, titles: [titled()], results: [] })

      expect(viewModel.search.titleBlock.kind).toBe('strong')
      expect(viewModel.search.titleBlock.purpose).toBeNull()
      expect(viewModel.search.titleBlock.alsoFound).toEqual([])
      expect(viewModel.search.summary).toBe('No sections with these words')
      expect(viewModel.search.listHeading).toBe('Sections that mention ‘claim’')
      expect(viewModel.search.listEmpty).toBe('No sections mention ‘claim’.')
      expect(viewModel.search.emptyMessage).toBeNull()
      expect(viewModel.search.noResults).toBeNull()
    })

    test('makes its links safe', () => {
      const viewModel = searched({ total: 0, titles: [titled(1, { href: 'javascript:alert(1)', sections: [{ ...result, href: 'javascript:alert(1)' }] })], results: [] })

      expect(viewModel.search.titleBlock.href).toBe('#')
      expect(viewModel.search.titleBlock.alsoFound[0].href).toBe('#')
    })

    test('promotes it on the first page only', () => {
      const viewModel = searched({ total: 15, titles: [titled()], results: [guide] }, 2)

      expect(viewModel.search.titleBlock).toBeNull()
      expect(viewModel.search.listHeading).toBeNull()
    })
  })

  describe('with several guides whose title the words cover', () => {
    test('lists them above the sections that have the words, marking their titles there too', () => {
      const listed = titled(2, { sectionTotal: 2, sections: [result] })
      const viewModel = searched({ total: 2, documentTotal: 3, titles: [titled(1), listed], results: [listed, guide] })

      expect(viewModel.search.titleBlock).toEqual({
        kind: 'several',
        label: '2 guides have ‘claim’ in their title',
        rows: [
          { title: 'CS MA Claim - Case 1', titleSnippet: titled(1).titleSnippet, href: '/guides/t-1', matchesText: null },
          { title: 'CS MA Claim - Case 2', titleSnippet: listed.titleSnippet, href: '/guides/t-2', matchesText: '2 matches' }
        ],
        showAll: null
      })
      expect(viewModel.search.listHeading).toBe('Sections that mention ‘claim’')
      expect(viewModel.search.guides[0].titleSnippet).toEqual(listed.titleSnippet)
      expect(viewModel.search.guides[1].titleSnippet).toBeNull()
    })

    test('shows the first five, with a link to the page again showing every one', () => {
      const titles = [1, 2, 3, 4, 5, 6].map((number) => titled(number))
      const viewModel = searched({ total: 0, titles, results: [] })

      expect(viewModel.search.titleBlock.rows.map((row) => row.href)).toEqual(['/guides/t-1', '/guides/t-2', '/guides/t-3', '/guides/t-4', '/guides/t-5'])
      expect(viewModel.search.titleBlock.showAll).toEqual({ href: '/hub?q=claim&titles=all#title-match-heading', text: 'Show all 6 guides' })
    })

    test('shows every one when every one was asked for', () => {
      const titles = [1, 2, 3, 4, 5, 6].map((number) => titled(number))
      const viewModel = new HubViewModel({ words: 'claim', search: { words: 'claim', page: 1, guide: null, allTitles: true, found: { unavailable: false, tooManyMatches: false, total: 0, documentTotal: 6, sectionTotal: 0, titles, results: [] } } })

      expect(viewModel.search.titleBlock.rows).toHaveLength(6)
      expect(viewModel.search.titleBlock.showAll).toBeNull()
    })

    test('says, under the heading over sections, that no sections mention the words when only titles have them', () => {
      const viewModel = searched({ total: 0, documentTotal: 2, titles: [titled(1), titled(2)], results: [] })

      expect(viewModel.search.summary).toBe('No sections with these words')
      expect(viewModel.search.listHeading).toBe('Sections that mention ‘claim’')
      expect(viewModel.search.listEmpty).toBe('No sections mention ‘claim’.')
    })

    test('shows five with no link to show all', () => {
      const titles = [1, 2, 3, 4, 5].map((number) => titled(number))
      const viewModel = searched({ total: 0, titles, results: [] })

      expect(viewModel.search.titleBlock.rows).toHaveLength(5)
      expect(viewModel.search.titleBlock.showAll).toBeNull()
    })
  })

  test('shows no title block when there are too many matches', () => {
    const viewModel = searched({ total: 0, tooManyMatches: true, titles: [titled()], results: [] })

    expect(viewModel.search.titleBlock).toBeNull()
    expect(viewModel.search.emptyMessage).toBe('Too many matches. Use more specific words.')
  })

  describe('inside one guide', () => {
    test('counts its sections, names it, and links back to every guide', () => {
      const viewModel = searched({ total: 1, results: [result] }, 1, GUIDE)

      expect(viewModel.search).toEqual({
        words: 'claim',
        heading: '1 match',
        summary: 'In CS final payments',
        backLink: { href: '/hub?q=claim', text: 'All guides with these words' },
        emptyMessage: null,
        noResults: null,
        titleBlock: null,
        listHeading: null,
        listEmpty: null,
        guideHeadingLevel: 3,
        guides: [],
        results: [{ title: '4.2 Claim rules', href: '/guides/g-1#claim-rules', hint: '1 match', snippet: [{ text: 'claim', match: true }] }],
        pagination: null
      })
    })

    test('pages its sections, keeping the guide', () => {
      const viewModel = searched({ total: 25, results: [result] }, 1, GUIDE)

      expect(viewModel.search.heading).toBe('25 matches')
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

  test('says when the words are too long to search for', () => {
    const viewModel = new HubViewModel({ wordsTooLong: true })

    expect(viewModel.wordsTooLong).toBe(true)
  })
})
