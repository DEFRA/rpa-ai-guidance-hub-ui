import { buildGuideSummaryCards } from '../../../../src/pages/create-guidance/guide-summary.js'

describe('buildGuideSummaryCards', () => {
  test('builds two summary cards with labelled answers', () => {
    const { guideDetailsCard, ownerPurposeCard } = buildGuideSummaryCards({
      metadata: {
        guideTitle: 'A title',
        schemes: ['Sustainable Farming Incentive (SFI)', 'Not scheme-specific'],
        owner: 'owner@example.com',
        goal: 'A purpose',
        requirements: 'Training',
        systems: ['CRM', 'Legacy'],
        audience: ['Processor']
      },
      stagedDocument: {
        version: '1.2',
        lastModified: '2026-06-29T10:00:00.000Z'
      },
      schemeOptions: [
        'Sustainable Farming Incentive (SFI)',
        'Not scheme-specific'
      ],
      systemOptions: ['CRM'],
      audienceOptions: ['Processor']
    })

    expect(guideDetailsCard).toEqual({
      title: { text: "The guide's details" },
      actions: {
        items: [{
          text: 'Change',
          href: '/create-guidance/upload-guide/metadata?from=check',
          visuallyHiddenText: "the guide's details"
        }]
      },
      rows: [
        { key: { text: 'Guidance title' }, value: { text: 'A title' } },
        { key: { text: 'Version number' }, value: { text: '1.2' } },
        { key: { text: 'Last modified date' }, value: { text: '29 June 2026' } },
        {
          key: { text: 'Scheme' },
          value: { text: 'Sustainable Farming Incentive (SFI), Not scheme-specific' }
        }
      ]
    })

    expect(ownerPurposeCard).toEqual({
      title: { text: 'Owner and purpose' },
      actions: {
        items: [{
          text: 'Change',
          href: '/create-guidance/upload-guide/metadata/purpose?from=check',
          visuallyHiddenText: 'the owner and purpose'
        }]
      },
      rows: [
        { key: { text: 'Owner email' }, value: { text: 'owner@example.com' } },
        { key: { text: 'Purpose of guidance' }, value: { text: 'A purpose' } },
        { key: { text: 'Required knowledge and training' }, value: { text: 'Training' } },
        { key: { text: 'Systems' }, value: { text: 'CRM, Legacy' } },
        { key: { text: 'Who is this guidance for?' }, value: { text: 'Processor' } }
      ]
    })
  })

  test('falls back to "Not provided" for missing metadata and staged document fields', () => {
    const { guideDetailsCard, ownerPurposeCard } = buildGuideSummaryCards()

    expect(guideDetailsCard.rows.map((row) => row.value.text)).toEqual([
      'Not provided',
      'Not provided',
      'Not provided',
      'Not provided'
    ])
    expect(ownerPurposeCard.rows.map((row) => row.value.text)).toEqual([
      'Not provided',
      'Not provided',
      'Not provided',
      'Not provided',
      'Not provided'
    ])
  })

  test('defaults the "Change" links to the metadata and purpose screens', () => {
    const { guideDetailsCard, ownerPurposeCard } = buildGuideSummaryCards()

    expect(guideDetailsCard.actions.items[0].href).toBe('/create-guidance/upload-guide/metadata?from=check')
    expect(ownerPurposeCard.actions.items[0].href).toBe('/create-guidance/upload-guide/metadata/purpose?from=check')
  })

  test('adds each answer\'s short label from the reference options, leaving unmatched labels as stored', () => {
    const { guideDetailsCard, ownerPurposeCard } = buildGuideSummaryCards({
      metadata: {
        schemes: ['Sustainable Farming Incentive', 'Retired scheme'],
        systems: ['CRM'],
        audience: ['Processor']
      },
      referenceOptions: {
        schemes: [{ label: 'Sustainable Farming Incentive', shortLabel: 'SFI' }],
        systems: [{ label: 'CRM', shortLabel: 'CRM' }],
        audience: [{ label: 'Processor' }]
      }
    })

    expect(guideDetailsCard.rows[3].value.text).toBe('Sustainable Farming Incentive (SFI), Retired scheme')
    expect(ownerPurposeCard.rows[3].value.text).toBe('CRM')
    expect(ownerPurposeCard.rows[4].value.text).toBe('Processor')
  })
})
