import {
  buildMetadataRows,
  GuideViewModel
} from '../../../../src/pages/guide/view-model.js'

const sections = [
  { id: 'section-1', title: 'Introduction', markdown: 'One.', subheadings: [] },
  {
    id: 'section-2',
    title: 'Assign case',
    markdown: 'Two.',
    subheadings: [{ title: '2.1 Check', slug: '21-check' }, { title: '2.2 Assign', slug: '22-assign' }]
  },
  {
    id: 'section-3',
    title: 'Close case',
    markdown: 'Three.',
    subheadings: [{ title: '3.1 Close', slug: '31-close' }]
  }
]

function guide (overrides = {}) {
  return {
    id: 'guide-1',
    title: 'Claiming the SFI payment',
    lastUpdated: '2026-10-06T08:00:00Z',
    versions: [{ id: 'v2' }, { id: 'v1' }],
    ...overrides
  }
}

function build (overrides = {}) {
  return new GuideViewModel({
    guide: guide(),
    sections,
    pageNumber: 2,
    readingWidth: 'wide',
    returnTo: '/guides/guide-1?page=2',
    metadataRows: [],
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
      { title: 'Introduction', href: '/guides/guide-1?page=1', isCurrent: false },
      { title: 'Assign case', href: '/guides/guide-1?page=2', isCurrent: true },
      { title: 'Close case', href: '/guides/guide-1?page=3', isCurrent: false }
    ])
  })

  test('lists each section\'s subheadings, scrolling to those on this page and linking to the page for the rest', () => {
    const { contents } = build()

    expect(contents[0].subheadings).toEqual([])
    expect(contents[1].subheadings).toEqual([
      { title: '2.1 Check', href: '#21-check' },
      { title: '2.2 Assign', href: '#22-assign' }
    ])
    expect(contents[2].subheadings).toEqual([
      { title: '3.1 Close', href: '/guides/guide-1?page=3#31-close' }
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

    expect(viewModel.previous).toEqual({ href: '/guides/guide-1?page=1', labelText: 'Introduction' })
    expect(viewModel.next).toEqual({ href: '/guides/guide-1?page=3', labelText: 'Close case' })
  })

  test('has every section as a page, marking the current one, each with its own progress and neighbours', () => {
    const { pages } = build({ pageNumber: 2 })

    expect(pages.map(page => page.pageNumber)).toEqual([1, 2, 3])
    expect(pages.map(page => page.isCurrent)).toEqual([false, true, false])
    expect(pages[0].section).toBe(sections[0])
    expect(pages.map(page => page.progressPercentage)).toEqual([33, 67, 100])
    expect(pages[0].previous).toBeNull()
    expect(pages[0].next).toEqual({ href: '/guides/guide-1?page=2', labelText: sections[1].title })
    expect(pages[2].next).toBeNull()
  })

  test('has no previous link on the first page and no next link on the last', () => {
    expect(build({ pageNumber: 1 }).previous).toBeNull()
    expect(build({ pageNumber: 3 }).next).toBeNull()
  })

  test('tags the latest version by how many there are, and its colour cycles', () => {
    expect(build().version).toEqual({ text: 'Version 2', colour: 'purple' })
    expect(build({ guide: guide({ versions: [{}] }) }).version).toEqual({ text: 'Version 1', colour: 'green' })
    expect(build({ guide: guide({ versions: new Array(7).fill({}) }) }).version).toEqual({
      text: 'Version 7',
      colour: 'green'
    })
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

  test('leaves out what the guide does not say', () => {
    expect(buildMetadataRows({ goal: 'Only this.', owner: 'a@example.com' })).toEqual([
      { label: 'Purpose', text: 'Only this.' },
      { label: 'Owner', text: 'a@example.com', href: 'mailto:a%40example.com' }
    ])
    expect(buildMetadataRows(undefined)).toEqual([])
  })

})
