import { filterPanel, filtersFrom, listHref, sortFrom } from '../../../../src/pages/hub/filters.js'

const NONE = { audience: [], system: [], scheme: [] }

const COUNTS = {
  audience: [{ label: 'Processor', shortLabel: null, count: 3 }, { label: 'Checker', shortLabel: null, count: 1 }],
  system: [{ label: 'CRM', shortLabel: null, count: 3 }],
  scheme: [{ label: 'Countryside Stewardship', shortLabel: 'CS', count: 3 }]
}

describe('filtersFrom', () => {
  test('reads each filter\'s chosen values from the address, one or several', () => {
    expect(filtersFrom({ audience: 'Processor', system: ['CRM', 'SITI Agri'] })).toEqual({
      audience: ['Processor'],
      system: ['CRM', 'SITI Agri'],
      scheme: []
    })
  })

  test('ignores empty values and anything that is not a filter', () => {
    expect(filtersFrom({ audience: '', year: '2026', q: 'claims' })).toEqual(NONE)
  })
})

describe('sortFrom', () => {
  test.each([
    [undefined, 'updated-newest'],
    ['updated-oldest', 'updated-oldest'],
    ['most-relevant', 'updated-newest'],
    [['updated-oldest', 'updated-newest'], 'updated-newest']
  ])('takes %j as %s', (sort, expected) => {
    expect(sortFrom({ sort })).toBe(expected)
  })
})

describe('listHref', () => {
  test('carries each chosen value as a repeated parameter, and the sort when it is not the default', () => {
    expect(listHref('/hub', { audience: ['Processor'], system: ['CRM', 'SITI Agri'], scheme: [] }, 'updated-oldest'))
      .toBe('/hub?audience=Processor&system=CRM&system=SITI+Agri&sort=updated-oldest')
  })

  test('is the path alone with no filters and the default sort', () => {
    expect(listHref('/hub/recently-opened', NONE, 'updated-newest')).toBe('/hub/recently-opened')
  })
})

describe('filterPanel', () => {
  const panel = (overrides = {}) => filterPanel({
    path: '/hub',
    filters: NONE,
    counts: COUNTS,
    sort: 'updated-newest',
    total: 3,
    withSort: true,
    ...overrides
  })

  test('offers who it\'s for, the system and the scheme year, each value with its count', () => {
    const { groups } = panel()

    expect(groups.map(group => [group.name, group.legend])).toEqual([
      ['audience', "Who it's for"],
      ['system', 'System used'],
      ['year', 'Scheme year']
    ])
    expect(groups[0].options).toEqual([
      { value: 'Processor', text: 'Processor', count: 3, checked: false, disabled: false },
      { value: 'Checker', text: 'Checker', count: 1, checked: false, disabled: false }
    ])
  })

  test('has 2026 as the only scheme year, checked and disabled, counting every guide shown', () => {
    expect(panel().groups[2].options).toEqual([
      { value: '2026', text: '2026', count: 3, checked: true, disabled: true }
    ])
  })

  test('offers the scheme only when the guides have more than one', () => {
    const twoSchemes = { ...COUNTS, scheme: [...COUNTS.scheme, { label: 'Basic Payment Scheme', shortLabel: 'BPS', count: 1 }] }

    const { groups } = panel({ counts: twoSchemes })

    expect(groups.at(-1)).toMatchObject({ name: 'scheme', legend: 'Scheme' })
    expect(groups.at(-1).options.map(option => option.text)).toEqual([
      'Countryside Stewardship (CS)',
      'Basic Payment Scheme (BPS)'
    ])
  })

  test('checks the chosen values, and shows each as a tag that takes it away', () => {
    const filters = { audience: ['Checker'], system: ['CRM'], scheme: [] }

    const { groups, selected, clearHref } = panel({ filters, sort: 'updated-oldest' })

    expect(groups[0].options.map(option => option.checked)).toEqual([false, true])
    expect(selected).toEqual([
      { text: 'Checker', href: '/hub?system=CRM&sort=updated-oldest' },
      { text: 'CRM', href: '/hub?audience=Checker&sort=updated-oldest' }
    ])
    expect(clearHref).toBe('/hub?sort=updated-oldest')
  })

  test('offers the sorts, the chosen one selected, with Most relevant disabled until search exists', () => {
    expect(panel({ sort: 'updated-oldest' }).sort).toEqual({
      options: [
        { value: 'updated-newest', text: 'Recently updated', selected: false, disabled: false },
        { value: 'updated-oldest', text: 'Oldest updated', selected: true, disabled: false },
        { value: 'most-relevant', text: 'Most relevant', selected: false, disabled: true }
      ]
    })
  })

  test('has no sort where the list keeps its own order', () => {
    expect(panel({ withSort: false }).sort).toBeNull()
  })

  test('sends the form to the list it is on', () => {
    expect(panel({ path: '/hub/recently-opened' }).action).toBe('/hub/recently-opened')
  })
})
