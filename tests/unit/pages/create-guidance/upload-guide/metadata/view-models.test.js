import { GuideDetailsViewModel } from '../../../../../../src/pages/create-guidance/upload-guide/metadata/view-models.js'

describe('#GuideDetailsViewModel', () => {
  test('fromSession() populates values from session metadata', () => {
    const schemeOptions = [
      { value: 'sfi', text: 'Sustainable Farming Incentive' },
      { value: 'none', text: 'Not scheme-specific' }
    ]

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
    expect(viewModel.schemeOptions).toEqual([
      { value: 'sfi', text: 'Sustainable Farming Incentive' },
      { value: 'none', text: 'Not scheme-specific', divider: 'or' }
    ])
    expect(viewModel.errors).toEqual({})
    expect(viewModel.errorList).toEqual([])
    expect(viewModel.notification).toBeNull()
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

  test('fromSession() carries a flashed notification through to the view model', () => {
    const viewModel = GuideDetailsViewModel.fromSession({
      values: {},
      schemeOptions: [],
      notification: 'You have already uploaded a document for this guide'
    })

    expect(viewModel.notification).toBe('You have already uploaded a document for this guide')
  })

  test('fromSession() populates title, version and formatted last modified date from a draft', () => {
    const viewModel = GuideDetailsViewModel.fromSession({
      values: {},
      draft: {
        title: 'Parsed Draft Title',
        version: '3.1',
        lastModified: '2026-05-10T12:00:00.000Z'
      },
      schemeOptions: []
    })

    expect(viewModel.values.guideTitle).toBe('Parsed Draft Title')
    expect(viewModel.versionNumber).toBe('3.1')
    expect(viewModel.lastModifiedDate).toBe('10 May 2026')
  })

  test('fromSession() prefers a title already saved to session over the parsed draft title', () => {
    const viewModel = GuideDetailsViewModel.fromSession({
      values: { guideTitle: 'User Overwritten Title' },
      draft: {
        title: 'Parsed Draft Title',
        version: '3.1',
        lastModified: '2026-05-10T12:00:00.000Z'
      },
      schemeOptions: []
    })

    expect(viewModel.values.guideTitle).toBe('User Overwritten Title')
  })

  test('fromSession() falls back to "Not available" when the draft has an invalid last modified date', () => {
    const viewModel = GuideDetailsViewModel.fromSession({
      values: {},
      draft: {
        title: 'Parsed Draft Title',
        version: '3.1',
        lastModified: 'not-a-real-date'
      },
      schemeOptions: []
    })

    expect(viewModel.lastModifiedDate).toBe('Not available')
  })

  test('fromSession() defaults to "Not available" when no draft has been claimed yet', () => {
    const viewModel = GuideDetailsViewModel.fromSession({
      values: {},
      draft: null,
      schemeOptions: []
    })

    expect(viewModel.values.guideTitle).toBe('')
    expect(viewModel.versionNumber).toBe('Not available')
    expect(viewModel.lastModifiedDate).toBe('Not available')
  })

  test('fromValidationError() maps Joi error details to field errors and errorList with correct hrefs', () => {
    const payload = { guideTitle: '', schemes: '', otherField: '' }
    const err = {
      details: [
        { path: ['guideTitle'], message: 'Enter the guidance title' },
        { path: ['guideTitle'], message: 'Duplicate error for title' },
        { path: ['schemes'], message: 'Select at least one scheme this guidance relates to' },
        { path: ['otherField'], message: 'Other error' }
      ]
    }

    const viewModel = GuideDetailsViewModel.fromValidationError(payload, err)

    expect(viewModel.values).toEqual(payload)
    expect(viewModel.errors).toEqual({
      guideTitle: 'Enter the guidance title',
      schemes: 'Select at least one scheme this guidance relates to',
      otherField: 'Other error'
    })
    expect(viewModel.errorList).toEqual([
      { text: 'Enter the guidance title', href: '#guide-title' },
      { text: 'Select at least one scheme this guidance relates to', href: '#schemes' },
      { text: 'Other error', href: '#otherField' }
    ])
    expect(viewModel.versionNumber).toBe('Not available')
    expect(viewModel.lastModifiedDate).toBe('Not available')
  })

  test('fromValidationError() preserves the draft version and formatted last modified date', () => {
    const payload = { guideTitle: '' }
    const err = {
      details: [{ path: ['guideTitle'], message: 'Enter the guidance title' }]
    }

    const viewModel = GuideDetailsViewModel.fromValidationError(payload, err, {
      draft: {
        title: 'Parsed Draft Title',
        version: '3.1',
        lastModified: '2026-05-10T12:00:00.000Z'
      }
    })

    expect(viewModel.versionNumber).toBe('3.1')
    expect(viewModel.lastModifiedDate).toBe('10 May 2026')
  })

  test('constructor defaults when initialized with no arguments', () => {
    const viewModel = new GuideDetailsViewModel()

    expect(viewModel.values).toEqual({})
    expect(viewModel.errors).toEqual({})
    expect(viewModel.errorList).toEqual([])
    expect(viewModel.versionNumber).toBe('Not available')
    expect(viewModel.lastModifiedDate).toBe('Not available')
    expect(viewModel.schemeOptions).toEqual([])
    expect(viewModel.backUrl).toBe('/create-guidance/upload-guide')
    expect(viewModel.notification).toBeNull()
  })
})
