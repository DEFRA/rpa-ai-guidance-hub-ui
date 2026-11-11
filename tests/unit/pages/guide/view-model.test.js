import {
  buildInfoRows,
  GuideViewModel
} from '../../../../src/pages/guide/view-model.js'

const sections = [
  { id: 'section-1', title: 'Introduction', slug: 'introduction', sectionAnchor: 'introduction', markdown: 'One.', headingIds: [], headingSectionAnchors: [], subheadings: [] },
  {
    id: 'section-2',
    title: 'Assign case',
    slug: 'assign-case',
    sectionAnchor: 'assign-case',
    markdown: 'Two.',
    headingIds: ['21-check', '22-assign'],
    headingSectionAnchors: ['21-check', '22-assign'],
    subheadings: [{ title: '2.1 Check', slug: '21-check' }, { title: '2.2 Assign', slug: '22-assign' }]
  },
  {
    id: 'section-3',
    title: 'Close case',
    slug: 'close-case',
    sectionAnchor: 'close-case',
    markdown: 'Three.',
    headingIds: ['31-close'],
    headingSectionAnchors: ['31-close'],
    subheadings: [{ title: '3.1 Close', slug: '31-close' }]
  }
]

function guide (overrides = {}) {
  return {
    id: 'guide-1',
    title: 'Claiming the SFI payment',
    lastUpdated: '2026-10-06T08:00:00Z',
    versions: [{ id: 'v2', versionNumber: '2.1' }, { id: 'v1', versionNumber: '1.0' }],
    latestVersion: { id: 'v2', versionNumber: '2.1' },
    ...overrides
  }
}

function build (overrides = {}) {
  return new GuideViewModel({
    guide: guide(),
    sections,
    pageNumber: 2,
    readingWidth: 'wide',
    returnTo: '/guides/guide-1?section=assign-case',
    // A section at a time, which most of what follows is about.
    format: 'stepper',
    ...overrides
  })
}

describe('GuideViewModel', () => {
  test('shows the current section out of all of them', () => {
    const viewModel = build()

    expect(viewModel.section).toBe(sections[1])
    expect(viewModel.pageNumber).toBe(2)
    expect(viewModel.totalPages).toBe(3)
  })

  test('lists every section in the contents, marking the current one', () => {
    expect(build().contents.map(({ title, href, isCurrent }) => ({ title, href, isCurrent }))).toEqual([
      { title: 'Introduction', href: '/guides/guide-1?section=introduction', isCurrent: false },
      { title: 'Assign case', href: '/guides/guide-1?section=assign-case', isCurrent: true },
      { title: 'Close case', href: '/guides/guide-1?section=close-case', isCurrent: false }
    ])
  })

  test('lists each section\'s subheadings, scrolling to those on this page and linking to the page for the rest', () => {
    const { contents } = build()

    expect(contents[0].subheadings).toEqual([])
    expect(contents[1].subheadings).toEqual([
      { title: '2.1 Check', href: '#21-check', anchor: '21-check' },
      { title: '2.2 Assign', href: '#22-assign', anchor: '22-assign' }
    ])
    expect(contents[2].subheadings).toEqual([
      { title: '3.1 Close', href: '/guides/guide-1?section=close-case#31-close', anchor: '31-close' }
    ])
  })

  test.each([[1, 33], [2, 67], [3, 100]])('is %i of 3 pages, %i%% through the guide', (pageNumber, percentage) => {
    expect(build({ pageNumber }).progressPercentage).toBe(percentage)
  })

  test('is not through a guide with no sections', () => {
    expect(build({ sections: [], pageNumber: 1 }).progressPercentage).toBe(0)
  })

  test('names the sections either side in the previous and next links', () => {
    const viewModel = build()

    expect(viewModel.previous).toEqual({ href: '/guides/guide-1?section=introduction', labelText: 'Introduction' })
    expect(viewModel.next).toEqual({ href: '/guides/guide-1?section=close-case', labelText: 'Close case' })
  })

  test('has every section as a page, showing only the current one, each with its own progress and neighbours', () => {
    const { pages } = build({ pageNumber: 2 })

    expect(pages.map(page => page.pageNumber)).toEqual([1, 2, 3])
    expect(pages.map(page => page.isCurrent)).toEqual([false, true, false])
    expect(pages.map(page => page.isShown)).toEqual([false, true, false])
    expect(pages[0].section).toBe(sections[0])
    expect(pages.map(page => page.progressPercentage)).toEqual([33, 67, 100])
    expect(pages[0].previous).toBeNull()
    expect(pages[0].next).toEqual({ href: '/guides/guide-1?section=assign-case', labelText: sections[1].title })
    expect(pages[2].next).toBeNull()
  })

  test('names the first page by the guide\'s address alone when it has no heading of its own', () => {
    const untitled = [{ ...sections[0], slug: null, sectionAnchor: null }, sections[1]]

    expect(build({ sections: untitled }).contents[0].href).toBe('/guides/guide-1')
  })

  test('names a page whose heading the hub gives no anchor by the heading\'s anchor on the page', () => {
    const overview = [sections[0], { ...sections[1], title: 'Overview', slug: 'overview', sectionAnchor: null }]

    expect(build({ sections: overview }).contents[1].href).toBe('/guides/guide-1?section=overview')
  })

  test('has no previous link on the first page and no next link on the last', () => {
    expect(build({ pageNumber: 1 }).previous).toBeNull()
    expect(build({ pageNumber: 3 }).next).toBeNull()
  })

  test.each([['2.1'], ['1.0'], ['0.3'], ['7.2']])('tags the latest version %s by its number, in the live version\'s colour whatever the number', (number) => {
    const version = build({ guide: guide({ latestVersion: { id: 'v', versionNumber: number } }) }).version

    expect(version).toEqual({ text: `Version ${number}`, colour: 'green' })
  })

  test.each([
    ['made before versions had numbers', { id: 'v', versionNumber: null }],
    ['without a version', null]
  ])('tags no version for a guide %s', (_name, latestVersion) => {
    expect(build({ guide: guide({ latestVersion }) }).version).toBeNull()
  })

  test('says when the guide was last updated', () => {
    expect(build().lastUpdated).toBe('6 October 2026')
    expect(build({ guide: guide({ lastUpdated: null }) }).lastUpdated).toBeNull()
  })

  test('has a title when the guide has none', () => {
    expect(build({ guide: guide({ title: null }) }).title).toBe('Untitled guide')
  })

  test('offers the widths, and the chosen one', () => {
    const viewModel = build()

    expect(viewModel.readingWidth).toBe('wide')
    expect(viewModel.readingWidths.map(option => option.value)).toEqual(['standard', 'wide', 'full'])
  })
})

describe('GuideViewModel in the traditional view', () => {
  const traditional = (overrides = {}) => build({ format: 'traditional', ...overrides })

  test('shows every section', () => {
    expect(traditional().pages.map(page => page.isShown)).toEqual([true, true, true])
  })

  test('links the contents to each section on the page, marking none as current', () => {
    expect(traditional().contents.map(({ title, href, isCurrent }) => ({ title, href, isCurrent }))).toEqual([
      { title: 'Introduction', href: '#introduction', isCurrent: false },
      { title: 'Assign case', href: '#assign-case', isCurrent: false },
      { title: 'Close case', href: '#close-case', isCurrent: false }
    ])
  })

  test('scrolls to every subheading, all of them being on the page', () => {
    expect(traditional().contents[2].subheadings).toEqual([{ title: '3.1 Close', href: '#31-close', anchor: '31-close' }])
  })

  test('gives each entry the heading it goes to on the page, for the script that follows the reader; none for a section without one', () => {
    const untitled = [{ ...sections[0], slug: null, sectionAnchor: null }, sections[1]]

    expect(traditional().contents.map(entry => entry.anchor)).toEqual(['introduction', 'assign-case', 'close-case'])
    expect(traditional({ sections: untitled }).contents[0].anchor).toBe('')
  })

  test('takes a section without a heading of its own to the top of the guide', () => {
    const untitled = [{ ...sections[0], slug: null, sectionAnchor: null }, sections[1]]

    expect(traditional({ sections: untitled }).contents[0].href).toBe('#main-content')
  })
})

describe('GuideViewModel\'s choice of format', () => {
  test('offers each format, marking the chosen one', () => {
    expect(build({ format: 'traditional' }).formats).toEqual([
      { value: 'traditional', text: 'Traditional', isChosen: true },
      { value: 'stepper', text: 'Stepper', isChosen: false }
    ])
  })

  test.each([['traditional'], ['stepper']])('comes back from %s to the page and heading the address names', (format) => {
    expect(build({ format, pageNumber: 2 }).place).toBe('/guides/guide-1?section=assign-case#assign-case')
  })

  test('comes back to the page alone when its section has no heading of its own', () => {
    expect(build({ sections: [{ ...sections[0], slug: null, sectionAnchor: null }], pageNumber: 1 }).place).toBe('/guides/guide-1')
  })
})

describe('buildInfoRows', () => {
  const guide = {
    lastUpdated: '2026-10-06T08:00:00Z',
    metadata: {
      schemes: ['Sustainable Farming Incentive (SFI)', 'Countryside Stewardship'],
      schemeYear: 2026,
      owner: 'owner@example.com',
      goal: 'Explain the claim.',
      requirements: 'Know the rules.',
      systems: ['CRM', 'SITI Agri'],
      audience: ['Processor']
    }
  }

  test('describes the guide in the upload\'s order, showing the labels the API sends', () => {
    expect(buildInfoRows(guide)).toEqual([
      { label: 'Last modified date', text: '6 October 2026' },
      { label: 'Scheme', text: 'Sustainable Farming Incentive (SFI), Countryside Stewardship' },
      { label: 'Scheme year', text: '2026' },
      { label: 'Owner email', text: 'owner@example.com', href: 'mailto:owner%40example.com' },
      { label: 'Purpose of guidance', text: 'Explain the claim.' },
      { label: 'Required knowledge and training', text: 'Know the rules.' },
      { label: 'Systems', text: 'CRM, SITI Agri' },
      { label: 'Who is this guidance for?', text: 'Processor' }
    ])
  })

  test('says what the guide does not say is not provided, with no link for a missing owner', () => {
    expect(buildInfoRows({ lastUpdated: null, metadata: {} })).toEqual([
      'Last modified date', 'Scheme', 'Scheme year', 'Owner email', 'Purpose of guidance',
      'Required knowledge and training', 'Systems', 'Who is this guidance for?'
    ].map(label => ({ label, text: 'Not provided' })))
  })

  test('says a guide with no scheme is not scheme-specific', () => {
    expect(buildInfoRows({ metadata: { schemes: [] } })[1]).toEqual({ label: 'Scheme', text: 'Not scheme-specific' })
  })
})

describe('GuideViewModel\'s information', () => {
  test('is hidden unless the user chose to show it', () => {
    expect(build().informationShown).toBe(false)
    expect(build({ informationShown: true }).informationShown).toBe(true)
  })
})
