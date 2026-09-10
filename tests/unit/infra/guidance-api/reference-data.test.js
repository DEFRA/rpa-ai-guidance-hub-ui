import { guidanceApiClient } from '../../../../src/infra/guidance-api/client.js'
import {
  getSchemes,
  getAudiences,
  getSystems,
  getGuidanceTypes
} from '../../../../src/infra/guidance-api/reference-data.js'

describe('reference-data infra', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  test('getSchemes calls GET /reference/schemes', async () => {
    const requestSpy = vi.spyOn(guidanceApiClient, 'request').mockResolvedValue({
      ok: true,
      status: 200,
      data: [{ value: 'sfi', label: 'SFI' }]
    })

    const result = await getSchemes()

    expect(requestSpy).toHaveBeenCalledWith('/reference/schemes')
    expect(result).toEqual({ ok: true, status: 200, data: [{ value: 'sfi', label: 'SFI' }] })
  })

  test('getAudiences calls GET /reference/audiences', async () => {
    const requestSpy = vi.spyOn(guidanceApiClient, 'request').mockResolvedValue({ ok: true, status: 200, data: [] })

    await getAudiences()

    expect(requestSpy).toHaveBeenCalledWith('/reference/audiences')
  })

  test('getSystems calls GET /reference/systems', async () => {
    const requestSpy = vi.spyOn(guidanceApiClient, 'request').mockResolvedValue({ ok: true, status: 200, data: [] })

    await getSystems()

    expect(requestSpy).toHaveBeenCalledWith('/reference/systems')
  })

  test('getGuidanceTypes calls GET /reference/guidance-types', async () => {
    const requestSpy = vi.spyOn(guidanceApiClient, 'request').mockResolvedValue({ ok: true, status: 200, data: [] })

    await getGuidanceTypes()

    expect(requestSpy).toHaveBeenCalledWith('/reference/guidance-types')
  })
})
