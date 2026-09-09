import { GuideDetailsViewModel } from '../../../../../../src/pages/create-guidance/upload-guide/metadata/view-models.js'

describe('#GuideDetailsViewModel', () => {
  test('fromSession() populates values from session metadata', () => {
    const schemeOptions = [{ value: 'sfi', text: 'Sustainable Farming Incentive' }]

    const viewModel = GuideDetailsViewModel.fromSession({
      values: {
        guideTitle: 'Saved Title',
        schemes: 'sfi',
        versionNumber: '1.2',
        lastModifiedDate: '10 May 2026'
      },
      schemeOptions
    })

    expect(viewModel.values.guideTitle).toBe('Saved Title')
    expect(viewModel.values.schemes).toBe('sfi')
    expect(viewModel.versionNumber).toBe('1.2')
    expect(viewModel.lastModifiedDate).toBe('10 May 2026')
    expect(viewModel.schemeOptions).toEqual(schemeOptions)
    expect(viewModel.errors).toEqual({})
    expect(viewModel.errorList).toEqual([])
  })

  test('fromSession() defaults version and date to "Not available" when missing', () => {
    const viewModel = GuideDetailsViewModel.fromSession({
      values: {},
      schemeOptions: []
    })

    expect(viewModel.values.guideTitle).toBe('')
    expect(viewModel.values.schemes).toBe('')
    expect(viewModel.versionNumber).toBe('Not available')
    expect(viewModel.lastModifiedDate).toBe('Not available')
  })

  test('fromValidationError() maps Joi error details to field errors and errorList with correct hrefs', () => {
    const payload = { guideTitle: '', schemes: '' }
    const err = {
      details: [
        { path: ['guideTitle'], message: 'Enter the guidance title' },
        { path: ['schemes'], message: 'Select at least one scheme this guidance relates to' }
      ]
    }

    const viewModel = GuideDetailsViewModel.fromValidationError(payload, err)

    expect(viewModel.values).toEqual(payload)
    expect(viewModel.errors).toEqual({
      guideTitle: 'Enter the guidance title',
      schemes: 'Select at least one scheme this guidance relates to'
    })
    expect(viewModel.errorList).toEqual([
      { text: 'Enter the guidance title', href: '#guide-title' },
      { text: 'Select at least one scheme this guidance relates to', href: '#schemes' }
    ])
    expect(viewModel.versionNumber).toBe('Not available')
    expect(viewModel.lastModifiedDate).toBe('Not available')
  })
})
