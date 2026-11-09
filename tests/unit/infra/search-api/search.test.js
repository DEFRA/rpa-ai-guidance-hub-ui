import { searchApiClient } from '../../../../src/infra/search-api/client.js'
import { searchSections } from '../../../../src/infra/search-api/search.js'

vi.mock('../../../../src/infra/search-api/client.js', () => ({
  searchApiClient: { request: vi.fn() }
}))

describe('#searchSections', () => {
  test('searches the sections for the words, a page at a time', async () => {
    searchApiClient.request.mockResolvedValue({ ok: true, status: 200, data: {} })

    const result = await searchSections({ words: 'claim rules', limit: 10, offset: 20 })

    expect(searchApiClient.request).toHaveBeenCalledWith('/v1/search', {
      query: { q: 'claim rules', limit: 10, offset: 20 }
    })
    expect(result).toEqual({ ok: true, status: 200, data: {} })
  })
})
