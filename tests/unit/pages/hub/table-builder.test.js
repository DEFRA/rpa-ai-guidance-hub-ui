import { buildGuidanceTable } from '../../../../src/pages/hub/table-builder.js'

describe('#buildGuidanceTable', () => {
  describe('when there are no guidance items', () => {
    test('Should return an empty state with the placeholder message', () => {
      const result = buildGuidanceTable([])

      expect(result).toEqual({
        isEmpty: true,
        count: 0
      })
    })

    test('Should return an empty state when called with no arguments', () => {
      const result = buildGuidanceTable()

      expect(result.isEmpty).toBe(true)
      expect(result.count).toBe(0)
    })
  })

  describe('when there are guidance items', () => {
    const items = [
      {
        title: 'CS MA Claim - Revenue Options Claim Rule at Signoff 2026',
        href: '/guidance/1',
        lastModified: '20 July 2026',
        version: '1',
        removeHref: '/hub/remove/1'
      }
    ]

    test('Should return the head columns and a non-empty state', () => {
      const result = buildGuidanceTable(items)

      expect(result.isEmpty).toBe(false)
      expect(result.count).toBe(1)
      expect(result.head).toEqual([
        { text: 'Title' },
        { text: 'Last modified' },
        { text: 'Version' },
        { text: 'Action' }
      ])
    })

    test('Should build a row with a title link, last modified text, version tag and remove link', () => {
      const result = buildGuidanceTable(items)

      expect(result.rows).toEqual([
        [
          { html: '<a class="govuk-link" href="/guidance/1">CS MA Claim - Revenue Options Claim Rule at Signoff 2026</a>' },
          { text: '20 July 2026' },
          { html: '<strong class="govuk-tag govuk-tag--green">1</strong>' },
          { html: '<a class="govuk-link" href="/hub/remove/1">Remove</a>' }
        ]
      ])
    })
  })
})
