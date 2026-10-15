import * as referenceDataApi from '../../../src/infra/guidance-api/reference-data.js'
import * as referenceData from '../../../src/services/reference-data.js'

vi.mock('../../../src/infra/guidance-api/reference-data.js')

describe('reference-data service', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  test('getSchemes appends the "None" opt-out option to the infra response data', async () => {
    referenceDataApi.getSchemes.mockResolvedValue({
      ok: true,
      status: 200,
      data: [
        { value: 'sfi', label: 'Sustainable Farming Incentive (SFI)' },
        { value: 'countryside-stewardship', label: 'Countryside Stewardship (CS)' }
      ]
    })

    const result = await referenceData.getSchemes()

    expect(result).toEqual([
      { value: 'sfi', label: 'Sustainable Farming Incentive (SFI)' },
      { value: 'countryside-stewardship', label: 'Countryside Stewardship (CS)' },
      { value: 'none', label: 'Not scheme-specific' }
    ])
  })

  test('getAudiences returns the infra response data unchanged', async () => {
    referenceDataApi.getAudiences.mockResolvedValue({
      ok: true,
      status: 200,
      data: [{ value: 'caseworker', label: 'Caseworker' }]
    })

    expect(await referenceData.getAudiences()).toEqual([{ value: 'caseworker', label: 'Caseworker' }])
  })

  test('getSystems returns the infra response data unchanged', async () => {
    referenceDataApi.getSystems.mockResolvedValue({
      ok: true,
      status: 200,
      data: [{ value: 'siti-agri', label: 'Siti Agri' }]
    })

    expect(await referenceData.getSystems()).toEqual([{ value: 'siti-agri', label: 'Siti Agri' }])
  })

  test('getGuidanceTypes returns the infra response data unchanged', async () => {
    referenceDataApi.getGuidanceTypes.mockResolvedValue({
      ok: true,
      status: 200,
      data: [{ value: 'process-guide', label: 'Process guide' }]
    })

    expect(await referenceData.getGuidanceTypes()).toEqual([{ value: 'process-guide', label: 'Process guide' }])
  })
})

describe('#normalizeSchemes', () => {
  test('returns ["none"] when only "none" is selected (string form)', () => {
    expect(referenceData.normalizeSchemes('none')).toEqual(['none'])
  })

  test('returns ["none"] when only "none" is selected (array form)', () => {
    expect(referenceData.normalizeSchemes(['none'])).toEqual(['none'])
  })

  test('drops "none" when a non-none option is also selected (none then other)', () => {
    expect(referenceData.normalizeSchemes(['none', 'sfi'])).toEqual(['sfi'])
  })

  test('drops "none" when a non-none option is also selected (other then none)', () => {
    expect(referenceData.normalizeSchemes(['sfi', 'none'])).toEqual(['sfi'])
  })

  test('drops "none" when multiple non-none options are selected alongside it', () => {
    expect(referenceData.normalizeSchemes(['none', 'sfi', 'bps'])).toEqual(['sfi', 'bps'])
  })

  test('preserves multiple non-none options unchanged when "none" is absent', () => {
    expect(referenceData.normalizeSchemes(['sfi', 'bps'])).toEqual(['sfi', 'bps'])
  })

  test('normalizes a single non-none string value into an array unchanged', () => {
    expect(referenceData.normalizeSchemes('sfi')).toEqual(['sfi'])
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
