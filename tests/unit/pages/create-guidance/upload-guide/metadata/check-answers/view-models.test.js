import { CheckAnswersViewModel } from '../../../../../../../src/pages/create-guidance/upload-guide/metadata/check-answers/view-models.js'

describe('CheckAnswersViewModel', () => {
  test('fromSession() builds two summary cards with labelled answers', () => {
    const viewModel = CheckAnswersViewModel.fromSession({
      metadata: {
        guideTitle: 'A title',
        schemes: ['sfi', 'none'],
        owner: 'owner@example.com',
        goal: 'A purpose',
        requirements: 'Training',
        systems: ['crm', 'legacy'],
        audience: ['processor']
      },
      stagedDocument: {
        version: '1.2',
        lastModified: '2026-06-29T10:00:00.000Z'
      },
      schemeOptions: [
        { value: 'sfi', label: 'Sustainable Farming Incentive (SFI)' },
        { value: 'none', label: 'Not scheme-specific' }
      ],
      systemOptions: [{ value: 'crm', label: 'CRM' }],
      audienceOptions: [{ value: 'processor', label: 'Processor' }]
    })

    expect(viewModel.guideDetailsCard).toEqual({
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
          value: {
            text: 'Sustainable Farming Incentive (SFI), Not scheme-specific'
          }
        }
      ]
    })

    expect(viewModel.ownerPurposeCard).toEqual({
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
        {
          key: { text: 'Required knowledge and training' },
          value: { text: 'Training' }
        },
        { key: { text: 'Systems' }, value: { text: 'CRM, legacy' } },
        { key: { text: 'Who is this guidance for?' }, value: { text: 'Processor' } }
      ]
    })

    expect(viewModel.backUrl).toBe('/create-guidance/upload-guide/metadata/purpose')
    expect(viewModel.pageTitle).toBe('Check the details before you convert')
  })

  test('fromSession() falls back to "Not provided" when fields are empty', () => {
    const viewModel = CheckAnswersViewModel.fromSession()

    expect(viewModel.guideDetailsCard.rows[0].value.text).toBe('Not provided')
    expect(viewModel.guideDetailsCard.rows[1].value.text).toBe('Not provided')
    expect(viewModel.guideDetailsCard.rows[2].value.text).toBe('Not provided')
    expect(viewModel.guideDetailsCard.rows[3].value.text).toBe('Not provided')

    expect(viewModel.ownerPurposeCard.rows[0].value.text).toBe('Not provided')
    expect(viewModel.ownerPurposeCard.rows[1].value.text).toBe('Not provided')
    expect(viewModel.ownerPurposeCard.rows[2].value.text).toBe('Not provided')
    expect(viewModel.ownerPurposeCard.rows[3].value.text).toBe('Not provided')
    expect(viewModel.ownerPurposeCard.rows[4].value.text).toBe('Not provided')
  })

  test('fromSubmissionError() attaches an error message and link target', () => {
    const initial = CheckAnswersViewModel.fromSession()
    const errored = CheckAnswersViewModel.fromSubmissionError(
      initial,
      'The document could not be converted. Try again.'
    )

    expect(errored.errorList).toEqual([
      {
        text: 'The document could not be converted. Try again.',
        href: '#conversion-error'
      }
    ])
  })

  test('fromValidationError() keeps the summary cards and maps errors back to their screen', () => {
    const err = {
      details: [
        { path: ['schemes'], message: 'Select at least one scheme this guidance relates to' },
        { path: ['owner'], message: 'Enter an email address' }
      ]
    }

    const viewModel = CheckAnswersViewModel.fromValidationError({
      metadata: { guideTitle: 'A title', schemes: ['retired-scheme'], owner: '' }
    }, err)

    expect(viewModel.errorList).toEqual([
      {
        text: 'Select at least one scheme this guidance relates to',
        href: '/create-guidance/upload-guide/metadata?from=check'
      },
      {
        text: 'Enter an email address',
        href: '/create-guidance/upload-guide/metadata/purpose?from=check'
      }
    ])
    expect(viewModel.guideDetailsCard.rows[0].value.text).toBe('A title')
  })

  test('constructor defaults when initialized with no arguments', () => {
    const viewModel = new CheckAnswersViewModel()

    expect(viewModel.guideDetailsCard).toEqual({})
    expect(viewModel.ownerPurposeCard).toEqual({})
    expect(viewModel.errorList).toEqual([])
  })
})
