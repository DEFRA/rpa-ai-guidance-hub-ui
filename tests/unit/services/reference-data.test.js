import * as referenceDataApi from '../../../src/infra/guidance-api/reference-data.js'
import * as referenceData from '../../../src/services/reference-data.js'

vi.mock('../../../src/infra/guidance-api/reference-data.js')

describe('reference-data service', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  test('getSchemes appends the "Not scheme-specific" opt-out to the infra response labels', async () => {
    referenceDataApi.getSchemes.mockResolvedValue({
      ok: true,
      status: 200,
      data: [
        { label: 'Sustainable Farming Incentive (SFI)', shortLabel: 'SFI' },
        { label: 'Countryside Stewardship (CS)' }
      ]
    })

    const result = await referenceData.getSchemes()

    expect(result).toEqual([
      { label: 'Sustainable Farming Incentive (SFI)', shortLabel: 'SFI' },
      { label: 'Countryside Stewardship (CS)', shortLabel: 'Countryside Stewardship (CS)' },
      { label: 'Not scheme-specific', shortLabel: 'Not scheme-specific' }
    ])
  })

  test('getAudiences returns the infra response options, defaulting shortLabel to the label', async () => {
    referenceDataApi.getAudiences.mockResolvedValue({
      ok: true,
      status: 200,
      data: [{ label: 'Caseworker' }]
    })

    expect(await referenceData.getAudiences()).toEqual([{ label: 'Caseworker', shortLabel: 'Caseworker' }])
  })

  test('getSystems returns the infra response options, defaulting shortLabel to the label', async () => {
    referenceDataApi.getSystems.mockResolvedValue({
      ok: true,
      status: 200,
      data: [{ label: 'Siti Agri' }]
    })

    expect(await referenceData.getSystems()).toEqual([{ label: 'Siti Agri', shortLabel: 'Siti Agri' }])
  })

  test('getGuidanceTypes returns the infra response options, defaulting shortLabel to the label', async () => {
    referenceDataApi.getGuidanceTypes.mockResolvedValue({
      ok: true,
      status: 200,
      data: [{ label: 'Process guide' }]
    })

    expect(await referenceData.getGuidanceTypes()).toEqual([{ label: 'Process guide', shortLabel: 'Process guide' }])
  })
})

describe('#normalizeSchemes', () => {
  test('returns ["Not scheme-specific"] when only that option is selected (string form)', () => {
    expect(referenceData.normalizeSchemes('Not scheme-specific')).toEqual(['Not scheme-specific'])
  })

  test('returns ["Not scheme-specific"] when only that option is selected (array form)', () => {
    expect(referenceData.normalizeSchemes(['Not scheme-specific'])).toEqual(['Not scheme-specific'])
  })

  test('drops "Not scheme-specific" when a specific option is also selected (opt-out then other)', () => {
    expect(referenceData.normalizeSchemes(['Not scheme-specific', 'Sustainable Farming Incentive (SFI)'])).toEqual(['Sustainable Farming Incentive (SFI)'])
  })

  test('drops "Not scheme-specific" when a specific option is also selected (other then opt-out)', () => {
    expect(referenceData.normalizeSchemes(['Sustainable Farming Incentive (SFI)', 'Not scheme-specific'])).toEqual(['Sustainable Farming Incentive (SFI)'])
  })

  test('drops "Not scheme-specific" when multiple specific options are selected alongside it', () => {
    expect(referenceData.normalizeSchemes(['Not scheme-specific', 'Sustainable Farming Incentive (SFI)', 'Bps'])).toEqual(['Sustainable Farming Incentive (SFI)', 'Bps'])
  })

  test('preserves multiple specific options unchanged when "Not scheme-specific" is absent', () => {
    expect(referenceData.normalizeSchemes(['Sustainable Farming Incentive (SFI)', 'Bps'])).toEqual(['Sustainable Farming Incentive (SFI)', 'Bps'])
  })

  test('normalizes a single specific string value into an array unchanged', () => {
    expect(referenceData.normalizeSchemes('Sustainable Farming Incentive (SFI)')).toEqual(['Sustainable Farming Incentive (SFI)'])
  })

  test('returns [] for undefined selection', () => {
    expect(referenceData.normalizeSchemes(undefined)).toEqual([])
  })

  test('returns [] for empty string selection', () => {
    expect(referenceData.normalizeSchemes('')).toEqual([])
  })

  test('returns [] for empty array selection', () => {
    expect(referenceData.normalizeSchemes([])).toEqual([])
  })
})

describe('#normalizeSelection', () => {
  test('returns [] for undefined, null and empty string selections', () => {
    expect(referenceData.normalizeSelection(undefined)).toEqual([])
    expect(referenceData.normalizeSelection(null)).toEqual([])
    expect(referenceData.normalizeSelection('')).toEqual([])
  })

  test('wraps a single string value in an array', () => {
    expect(referenceData.normalizeSelection('crm')).toEqual(['crm'])
  })

  test('returns an array selection unchanged', () => {
    expect(referenceData.normalizeSelection(['crm', 'siti-agri'])).toEqual(['crm', 'siti-agri'])
  })

  test('returns an empty array unchanged', () => {
    expect(referenceData.normalizeSelection([])).toEqual([])
  })
})
