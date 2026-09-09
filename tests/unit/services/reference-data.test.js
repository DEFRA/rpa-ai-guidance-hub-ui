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

  test('getSchemes returns the infra response data unchanged', async () => {
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
      { value: 'countryside-stewardship', label: 'Countryside Stewardship (CS)' }
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
