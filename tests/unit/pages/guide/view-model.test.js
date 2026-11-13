import {
  buildMetadataRows,
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
    metadataRows: [],
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
      { title: '2.1 Check', href: '#21-check', anchor: '21-check', section: '21-check' },
      { title: '2.2 Assign', href: '#22-assign', anchor: '22-assign', section: '22-assign' }
    ])
    expect(contents[2].subheadings).toEqual([
      { title: '3.1 Close', href: '/guides/guide-1?section=close-case#31-close', anchor: '31-close', section: '31-close' }
    ])
  })

  test('names a subheading by the hub\'s anchor as well as its own on the page, which can differ for a repeated heading', () => {
    const repeated = [
      { id: 'section-1', title: 'One', slug: 'one', sectionAnchor: 'one', markdown: '', headingIds: ['help-1'], headingSectionAnchors: ['help'], subheadings: [{ title: 'Help', slug: 'help-1' }] },
      { id: 'section-2', title: 'Two', slug: 'two', sectionAnchor: 'two', markdown: '', headingIds: ['help-2'], headingSectionAnchors: ['help-1'], subheadings: [{ title: 'Help', slug: 'help-2' }] }
    ]
    const { contents } = build({ sections: repeated, pageNumber: 1 })

    expect(contents.map(entry => entry.subheadings[0])).toEqual([
      expect.objectContaining({ anchor: 'help-1', section: 'help' }),
      expect.objectContaining({ anchor: 'help-2', section: 'help-1' })
    ])
  })

  test.each([[1, 33], [2, 67], [3, 100]])('is %i of 3 pages, %i%% through the guide', (pageNumber, percentage) => {
    expect(build({ pageNumber }).progressPercentage).toBe(percentage)
  })

  test('is not through a guide with no sections', () => {
    expect(build({ sections: [], pageNumber: 1 }).progressPercentage).toBe(0)
  })

  test('has the panel open unless it is collapsed', () => {
    expect(build().panelCollapsed).toBe(false)
    expect(build({ panelCollapsed: true }).panelCollapsed).toBe(true)
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
    expect(traditional().contents[2].subheadings).toEqual([{ title: '3.1 Close', href: '#31-close', anchor: '31-close', section: '31-close' }])
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

describe('buildMetadataRows', () => {
  const metadata = {
    schemes: ['Sustainable Farming Incentive (SFI)'],
    audience: ['Processor', 'unknown-audience'],
    systems: ['CRM'],
    goal: 'Explain the claim.',
    requirements: 'Know the rules.',
    owner: 'owner@example.com'
  }

  test('describes the guide, showing the labels the API sends', () => {
    expect(buildMetadataRows(metadata)).toEqual([
      { label: 'Scheme', text: 'Sustainable Farming Incentive (SFI)' },
      { label: "Who it's for", text: 'Processor, unknown-audience' },
      { label: 'Systems used', text: 'CRM' },
      { label: 'Purpose', text: 'Explain the claim.' },
      { label: 'Required knowledge', text: 'Know the rules.' },
      { label: 'Owner', text: 'owner@example.com', href: 'mailto:owner%40example.com' }
    ])
  })

  test('says a guide with no scheme is not scheme-specific', () => {
    expect(buildMetadataRows({ schemes: [] })).toEqual([
      { label: 'Scheme', text: 'Not scheme-specific' }
    ])
  })

  test('leaves out what the guide does not say', () => {
    expect(buildMetadataRows({ goal: 'Only this.', owner: 'a@example.com' })).toEqual([
      { label: 'Purpose', text: 'Only this.' },
      { label: 'Owner', text: 'a@example.com', href: 'mailto:a%40example.com' }
    ])
    expect(buildMetadataRows(undefined)).toEqual([])
  })
})
