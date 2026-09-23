import { HEADS, buildGuidanceTable } from '../../../../src/pages/hub/table-builder.js'

describe('#buildGuidanceTable', () => {
  describe('when there are no guidance items', () => {
    test('Should return an empty state with count 0', () => {
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

  describe('when building recently opened or saved guidance', () => {
    const items = [
      {
        title: 'CS MA Claim - Revenue Options Claim Rule at Signoff 2026',
        href: '/guidance/1',
        lastModified: '20 July 2026',
        version: '1',
        removeHref: '/hub/remove/1'
      },
      {
        title: 'Basic Payment Scheme: closing rules',
        href: '/guidance/2',
        lastModified: '12 June 2025',
        version: '2',
        removeHref: '/hub/remove/2'
      }
    ]

    test('Should return the head columns and a non-empty state', () => {
      const result = buildGuidanceTable(items, 'recent')

      expect(result.isEmpty).toBe(false)
      expect(result.count).toBe(2)
      expect(result.head).toEqual(HEADS.recent)
    })

    test('Should build rows with published tag, title link, last modified, version tag and remove link', () => {
      const result = buildGuidanceTable(items, 'recent')

      expect(result.rows[0]).toEqual([
        {
          html: '<div class="govuk-!-margin-bottom-1"><strong class="govuk-tag govuk-tag--green">Published</strong></div><a class="govuk-link" href="/guidance/1">CS MA Claim - Revenue Options Claim Rule at Signoff 2026</a>'
        },
        { text: '20 July 2026' },
        { html: '<strong class="govuk-tag govuk-tag--green">1</strong>' },
        {
          html: '<a class="govuk-link" href="/hub/remove/1">Remove<span class="govuk-visually-hidden"> CS MA Claim - Revenue Options Claim Rule at Signoff 2026</span></a>'
        }
      ])

      expect(result.rows[1][2]).toEqual({
        html: '<strong class="govuk-tag govuk-tag--purple">2</strong>'
      })
    })
  })

  describe('when building editing guidance', () => {
    const items = [
      {
        title: 'Draft Guidance 1',
        href: '/manage-guidance/1',
        lastModified: '6 September 2026',
        version: '1',
        removeHref: '/manage-guidance/remove/1'
      }
    ]

    test('Should return editing head columns and draft rows', () => {
      const result = buildGuidanceTable(items, 'editing')

      expect(result.head).toEqual(HEADS.editing)
      expect(result.rows[0]).toEqual([
        {
          html: '<div class="govuk-!-margin-bottom-1"><strong class="govuk-tag govuk-tag--grey">Draft</strong></div><a class="govuk-link" href="/manage-guidance/1">Draft Guidance 1</a>'
        },
        { html: '<strong class="govuk-tag govuk-tag--green">1</strong>' },
        { text: '6 September 2026' },
        {
          html: '<a class="govuk-link" href="/manage-guidance/remove/1">Remove<span class="govuk-visually-hidden"> Draft Guidance 1</span></a>'
        }
      ])
    })
  })

  describe('when building awaiting approval guidance', () => {
    const items = [
      {
        title: 'Countryside Stewardship: capital grants',
        href: '/manage-guidance/cs',
        version: '1',
        publishingChecks: 'No issues',
        changesRequested: 'None'
      },
      {
        title: 'Basic Payment Scheme',
        href: '/manage-guidance/bps',
        version: '2',
        publishingChecks: '2 issues',
        changesRequested: '1 change requested'
      }
    ]

    test('Should return awaiting approval head columns and check rows without action column', () => {
      const result = buildGuidanceTable(items, 'awaiting-approval')

      expect(result.head).toEqual(HEADS['awaiting-approval'])
      expect(result.rows[0]).toEqual([
        {
          html: '<div class="govuk-!-margin-bottom-1"><strong class="govuk-tag govuk-tag--yellow">Awaiting approval</strong></div><a class="govuk-link" href="/manage-guidance/cs">Countryside Stewardship: capital grants</a>'
        },
        { html: '<strong class="govuk-tag govuk-tag--green">1</strong>' },
        { text: 'No issues' },
        { text: 'None' }
      ])
      expect(result.rows[1][2]).toEqual({ text: '2 issues' })
      expect(result.rows[1][3]).toEqual({ text: '1 change requested' })
    })
  })
})
