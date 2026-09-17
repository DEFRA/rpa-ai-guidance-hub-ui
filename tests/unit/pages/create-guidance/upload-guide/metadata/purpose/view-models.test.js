import { OwnerAndPurposeViewModel } from '../../../../../../../src/pages/create-guidance/upload-guide/metadata/purpose/view-models.js'

const systemOptions = [{ value: 'crm', label: 'CRM' }, { value: 'siti-agri', label: 'SITI Agri' }]
const audienceOptions = [{ value: 'processor', label: 'Processor' }]

describe('#OwnerAndPurposeViewModel', () => {
  test('fromSession() populates values from session metadata and maps option labels to text', () => {
    const viewModel = OwnerAndPurposeViewModel.fromSession({
      values: {
        guideTitle: 'Ignored here',
        owner: 'owner@example.com',
        goal: 'A purpose',
        requirements: 'Some training',
        systems: ['crm'],
        audience: ['processor']
      },
      systemOptions,
      audienceOptions
    })

    expect(viewModel.values).toEqual({
      owner: 'owner@example.com',
      goal: 'A purpose',
      requirements: 'Some training',
      systems: ['crm'],
      audience: ['processor']
    })
    expect(viewModel.systemOptions).toEqual([
      { value: 'crm', text: 'CRM' },
      { value: 'siti-agri', text: 'SITI Agri' }
    ])
    expect(viewModel.audienceOptions).toEqual([{ value: 'processor', text: 'Processor' }])
    expect(viewModel.errors).toEqual({})
    expect(viewModel.errorList).toEqual([])
  })

  test('fromSession() defaults text fields to empty strings and selections to empty arrays', () => {
    const viewModel = OwnerAndPurposeViewModel.fromSession({ values: {} })

    expect(viewModel.values).toEqual({
      owner: '',
      goal: '',
      requirements: '',
      systems: [],
      audience: []
    })
  })

  test('fromSession() copes with a null metadata object', () => {
    const viewModel = OwnerAndPurposeViewModel.fromSession({ values: undefined })

    expect(viewModel.values.owner).toBe('')
  })

  test('fromValidationError() maps Joi error details to field errors and summary links', () => {
    const payload = { owner: 'bad', goal: '', requirements: '', systems: [], audience: [] }
    const err = {
      details: [
        { path: ['owner'], message: 'Enter an email address in the correct format' },
        { path: ['goal'], message: 'Enter what this guidance aims to achieve' },
        { path: ['requirements'], message: 'Enter what users need to perform or understand' },
        { path: ['systems'], message: 'Select the systems this guidance uses' },
        { path: ['audience'], message: 'Select who this guidance is for' }
      ]
    }

    const viewModel = OwnerAndPurposeViewModel.fromValidationError(payload, err, { systemOptions, audienceOptions })

    expect(viewModel.values).toEqual(payload)
    expect(viewModel.errors).toEqual({
      owner: 'Enter an email address in the correct format',
      goal: 'Enter what this guidance aims to achieve',
      requirements: 'Enter what users need to perform or understand',
      systems: 'Select the systems this guidance uses',
      audience: 'Select who this guidance is for'
    })
    expect(viewModel.errorList.map((error) => error.href)).toEqual([
      '#owner', '#goal', '#requirements', '#systems', '#audience'
    ])
    expect(viewModel.systemOptions).toHaveLength(2)
  })

  test('constructor defaults when initialized with no arguments', () => {
    const viewModel = new OwnerAndPurposeViewModel()

    expect(viewModel.values).toEqual({})
    expect(viewModel.errors).toEqual({})
    expect(viewModel.errorList).toEqual([])
    expect(viewModel.systemOptions).toEqual([])
    expect(viewModel.audienceOptions).toEqual([])
    expect(viewModel.backUrl).toBe('/create-guidance/upload-guide/metadata')
    expect(viewModel.pageTitle).toBe('Owner and purpose')
  })

  test('constructor prefers a pre-mapped option text over the label', () => {
    const viewModel = new OwnerAndPurposeViewModel({
      systemOptions: [{ value: 'crm', text: 'Custom', label: 'CRM' }]
    })

    expect(viewModel.systemOptions).toEqual([{ value: 'crm', text: 'Custom' }])
  })
})
