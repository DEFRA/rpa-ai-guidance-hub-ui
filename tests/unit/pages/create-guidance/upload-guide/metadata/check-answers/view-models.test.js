import { CheckAnswersViewModel } from '../../../../../../../src/pages/create-guidance/upload-guide/metadata/check-answers/view-models.js'

describe('#CheckAnswersViewModel', () => {
  test('fromSession() builds one row per answer, labelling selections from the reference options', () => {
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
      schemeOptions: [{ value: 'sfi', label: 'SFI' }, { value: 'none', label: 'Not scheme-specific' }],
      systemOptions: [{ value: 'crm', label: 'CRM' }],
      audienceOptions: [{ value: 'processor', label: 'Processor' }]
    })

    expect(viewModel.rows).toEqual([
      { key: 'Guidance title', value: 'A title', changeUrl: '/create-guidance/upload-guide/metadata' },
      { key: 'Schemes', values: ['SFI', 'Not scheme-specific'], changeUrl: '/create-guidance/upload-guide/metadata' },
      { key: 'Owner email', value: 'owner@example.com', changeUrl: '/create-guidance/upload-guide/metadata/purpose' },
      { key: 'Purpose', value: 'A purpose', changeUrl: '/create-guidance/upload-guide/metadata/purpose' },
      { key: 'Required knowledge and training', value: 'Training', changeUrl: '/create-guidance/upload-guide/metadata/purpose' },
      { key: 'Systems', values: ['CRM', 'legacy'], changeUrl: '/create-guidance/upload-guide/metadata/purpose' },
      { key: 'Audience', values: ['Processor'], changeUrl: '/create-guidance/upload-guide/metadata/purpose' }
    ])
    expect(viewModel.backUrl).toBe('/create-guidance/upload-guide/metadata/purpose')
    expect(viewModel.hubUrl).toBe('/hub')
    expect(viewModel.pageTitle).toBe('Check your answers')
  })

  test('fromSession() tolerates missing metadata', () => {
    const viewModel = CheckAnswersViewModel.fromSession()

    expect(viewModel.rows).toHaveLength(7)
    expect(viewModel.rows[1].values).toEqual([])
  })

  test('constructor defaults when initialized with no arguments', () => {
    const viewModel = new CheckAnswersViewModel()

    expect(viewModel.rows).toEqual([])
  })
})
