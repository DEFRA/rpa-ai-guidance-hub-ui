import { MigrateMetadataViewModel } from '../../../../../src/pages/create-guidance/metadata/view-models.js'

describe('#MigrateMetadataViewModel', () => {
  test('empty() creates a view model with no values, errors or submission error', () => {
    const viewModel = MigrateMetadataViewModel.empty()

    expect(viewModel.values).toEqual({})
    expect(viewModel.errors).toEqual({})
    expect(viewModel.errorList).toEqual([])
    expect(viewModel.submissionError).toBeNull()
  })

  test('fromSession() populates values from saved session metadata', () => {
    const savedMetadata = { guidanceType: 'process', title: 'Submit your claim' }

    const viewModel = MigrateMetadataViewModel.fromSession(savedMetadata)

    expect(viewModel.values).toEqual(savedMetadata)
    expect(viewModel.errors).toEqual({})
  })

  test('fromSession() defaults to an empty object when no metadata is saved', () => {
    const viewModel = MigrateMetadataViewModel.fromSession()

    expect(viewModel.values).toEqual({})
  })

  test('fromValidationError() builds structured errors and errorList from Joi error details', () => {
    const payload = { guidanceType: '' }
    const err = {
      details: [
        { path: ['guidanceType'], message: 'Select the type of guidance' },
        { path: ['title'], message: 'Enter the guidance title' }
      ]
    }

    const viewModel = MigrateMetadataViewModel.fromValidationError(payload, err)

    expect(viewModel.values).toEqual(payload)
    expect(viewModel.errors).toEqual({
      guidanceType: 'Select the type of guidance',
      title: 'Enter the guidance title'
    })
    expect(viewModel.errorList).toEqual([
      { text: 'Select the type of guidance', href: '#guidanceType' },
      { text: 'Enter the guidance title', href: '#title' }
    ])
  })

  test('fromValidationError() ignores duplicate error details for the same field', () => {
    const payload = { guidanceType: '' }
    const err = {
      details: [
        { path: ['guidanceType'], message: 'Select the type of guidance' },
        { path: ['guidanceType'], message: 'Another duplicate message' }
      ]
    }

    const viewModel = MigrateMetadataViewModel.fromValidationError(payload, err)

    expect(viewModel.errors).toEqual({
      guidanceType: 'Select the type of guidance'
    })
    expect(viewModel.errorList).toHaveLength(1)
  })

  test('fromSubmissionError() records the submission error message', () => {
    const payload = { guidanceType: 'process' }

    const viewModel = MigrateMetadataViewModel.fromSubmissionError(
      payload,
      'Unable to save your guidance right now'
    )

    expect(viewModel.values).toEqual(payload)
    expect(viewModel.submissionError).toBe('Unable to save your guidance right now')
    expect(viewModel.errors).toEqual({})
    expect(viewModel.errorList).toEqual([])
  })
})
