import { guidanceApiClient } from '../../../../src/infra/guidance-api/client.js'
import * as referenceData from '../../../../src/infra/guidance-api/reference-data.js'

vi.mock('../../../../src/infra/guidance-api/client.js', () => ({
  guidanceApiClient: { request: vi.fn() }
}))

describe('reference-data infra', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  test('getSchemes calls GET /reference/schemes', async () => {
    guidanceApiClient.request.mockResolvedValue({
      ok: true,
      status: 200,
      data: ['SFI']
    })

    const result = await referenceData.getSchemes()

    expect(guidanceApiClient.request).toHaveBeenCalledWith('/reference/schemes')
    expect(result).toEqual({ ok: true, status: 200, data: ['SFI'] })
  })

  test('getAudiences calls GET /reference/audiences', async () => {
    guidanceApiClient.request.mockResolvedValue({ ok: true, status: 200, data: [] })

    await referenceData.getAudiences()

    expect(guidanceApiClient.request).toHaveBeenCalledWith('/reference/audiences')
  })

  test('getSystems calls GET /reference/systems', async () => {
    guidanceApiClient.request.mockResolvedValue({ ok: true, status: 200, data: [] })

    await referenceData.getSystems()

    expect(guidanceApiClient.request).toHaveBeenCalledWith('/reference/systems')
  })

  test('getGuidanceTypes calls GET /reference/guidance-types', async () => {
    guidanceApiClient.request.mockResolvedValue({ ok: true, status: 200, data: [] })

    await referenceData.getGuidanceTypes()

    expect(guidanceApiClient.request).toHaveBeenCalledWith('/reference/guidance-types')
  })
})
