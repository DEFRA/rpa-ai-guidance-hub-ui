import * as referenceDataApi from '../../../src/infra/guidance-api/reference-data.js'
import {
  getSchemes,
  getAudiences,
  getSystems,
  getGuidanceTypes,
  normalizeSchemes
} from '../../../src/services/reference-data.js'

describe('reference-data service', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  test('getSchemes appends the "None" opt-out option to the infra response data', async () => {
    vi.spyOn(referenceDataApi, 'getSchemes').mockResolvedValue({
      ok: true,
      status: 200,
      data: [
        { value: 'sfi', label: 'Sustainable Farming Incentive (SFI)' },
        { value: 'countryside-stewardship', label: 'Countryside Stewardship (CS)' }
      ]
    })

    const result = await getSchemes()

    expect(result).toEqual([
      { value: 'sfi', label: 'Sustainable Farming Incentive (SFI)' },
      { value: 'countryside-stewardship', label: 'Countryside Stewardship (CS)' },
      { value: 'none', label: 'Not scheme-specific' }
    ])
  })

  test('getAudiences returns the infra response data unchanged', async () => {
    vi.spyOn(referenceDataApi, 'getAudiences').mockResolvedValue({
      ok: true,
      status: 200,
      data: [{ value: 'caseworker', label: 'Caseworker' }]
    })

    expect(await getAudiences()).toEqual([{ value: 'caseworker', label: 'Caseworker' }])
  })

  test('getSystems returns the infra response data unchanged', async () => {
    vi.spyOn(referenceDataApi, 'getSystems').mockResolvedValue({
      ok: true,
      status: 200,
      data: [{ value: 'siti-agri', label: 'Siti Agri' }]
    })

    expect(await getSystems()).toEqual([{ value: 'siti-agri', label: 'Siti Agri' }])
  })

  test('getGuidanceTypes returns the infra response data unchanged', async () => {
    vi.spyOn(referenceDataApi, 'getGuidanceTypes').mockResolvedValue({
      ok: true,
      status: 200,
      data: [{ value: 'process-guide', label: 'Process guide' }]
    })

    expect(await getGuidanceTypes()).toEqual([{ value: 'process-guide', label: 'Process guide' }])
  })
})

describe('#normalizeSchemes', () => {
  test('returns ["none"] when only "none" is selected (string form)', () => {
    expect(normalizeSchemes('none')).toEqual(['none'])
  })

  test('returns ["none"] when only "none" is selected (array form)', () => {
    expect(normalizeSchemes(['none'])).toEqual(['none'])
  })

  test('drops "none" when a non-none option is also selected (none then other)', () => {
    expect(normalizeSchemes(['none', 'sfi'])).toEqual(['sfi'])
  })

  test('drops "none" when a non-none option is also selected (other then none)', () => {
    expect(normalizeSchemes(['sfi', 'none'])).toEqual(['sfi'])
  })

  test('drops "none" when multiple non-none options are selected alongside it', () => {
    expect(normalizeSchemes(['none', 'sfi', 'bps'])).toEqual(['sfi', 'bps'])
  })

  test('preserves multiple non-none options unchanged when "none" is absent', () => {
    expect(normalizeSchemes(['sfi', 'bps'])).toEqual(['sfi', 'bps'])
  })

  test('normalizes a single non-none string value into an array unchanged', () => {
    expect(normalizeSchemes('sfi')).toEqual(['sfi'])
  })

  test('returns [] for undefined selection', () => {
    expect(normalizeSchemes(undefined)).toEqual([])
  })

  test('returns [] for empty string selection', () => {
    expect(normalizeSchemes('')).toEqual([])
  })

  test('returns [] for empty array selection', () => {
    expect(normalizeSchemes([])).toEqual([])
  })
})
