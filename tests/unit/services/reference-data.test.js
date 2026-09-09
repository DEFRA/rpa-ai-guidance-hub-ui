import * as referenceDataApi from '../../../src/infra/guidance-api/reference-data.js'
import {
  getSchemes,
  getAudiences,
  getSystems,
  getGuidanceTypes
} from '../../../src/services/reference-data.js'

describe('reference-data service', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  test('getSchemes maps infra {value, label} options to {value, text}', async () => {
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
      { value: 'sfi', text: 'Sustainable Farming Incentive (SFI)' },
      { value: 'countryside-stewardship', text: 'Countryside Stewardship (CS)' },
      { value: 'none', text: 'Not scheme-specific', divider: 'or' }
    ])
  })

  test('getSchemes appends the local "not scheme-specific" option even when the API returns none', async () => {
    vi.spyOn(referenceDataApi, 'getSchemes').mockResolvedValue({
      ok: true,
      status: 200,
      data: []
    })

    const result = await getSchemes()

    expect(result).toEqual([
      { value: 'none', text: 'Not scheme-specific', divider: 'or' }
    ])
  })

  test('getAudiences maps infra {value, label} options to {value, text}', async () => {
    vi.spyOn(referenceDataApi, 'getAudiences').mockResolvedValue({
      ok: true,
      status: 200,
      data: [{ value: 'caseworker', label: 'Caseworker' }]
    })

    expect(await getAudiences()).toEqual([{ value: 'caseworker', text: 'Caseworker' }])
  })

  test('getSystems maps infra {value, label} options to {value, text}', async () => {
    vi.spyOn(referenceDataApi, 'getSystems').mockResolvedValue({
      ok: true,
      status: 200,
      data: [{ value: 'siti-agri', label: 'Siti Agri' }]
    })

    expect(await getSystems()).toEqual([{ value: 'siti-agri', text: 'Siti Agri' }])
  })

  test('getGuidanceTypes maps infra {value, label} options to {value, text}', async () => {
    vi.spyOn(referenceDataApi, 'getGuidanceTypes').mockResolvedValue({
      ok: true,
      status: 200,
      data: [{ value: 'process-guide', label: 'Process guide' }]
    })

    expect(await getGuidanceTypes()).toEqual([{ value: 'process-guide', text: 'Process guide' }])
  })
})
