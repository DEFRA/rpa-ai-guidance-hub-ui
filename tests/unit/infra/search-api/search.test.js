import { searchApiClient } from '../../../../src/infra/search-api/client.js'
import { searchDocuments, searchSections } from '../../../../src/infra/search-api/search.js'

vi.mock('../../../../src/infra/search-api/client.js', () => ({
  searchApiClient: { request: vi.fn() }
}))

describe('#searchSections', () => {
  test('searches the sections for the words, a page at a time', async () => {
    searchApiClient.request.mockResolvedValue({ ok: true, status: 200, data: {} })

    const result = await searchSections({ words: 'claim rules', limit: 10, offset: 20 })

    expect(searchApiClient.request).toHaveBeenCalledWith('/v1/search', {
      query: { q: 'claim rules', tag: undefined, limit: 10, offset: 20 }
    })
    expect(result).toEqual({ ok: true, status: 200, data: {} })
  })

  test('searches inside one guide when given one', async () => {
    searchApiClient.request.mockResolvedValue({ ok: true, status: 200, data: {} })

    await searchSections({ words: 'claim', guideId: 'g-1', limit: 10, offset: 0 })

    expect(searchApiClient.request).toHaveBeenCalledWith('/v1/search', {
      query: { q: 'claim', tag: 'g-1', limit: 10, offset: 0 }
    })
  })
})

describe('#searchDocuments', () => {
  test('searches for the words grouped by guide, a page of guides at a time', async () => {
    searchApiClient.request.mockResolvedValue({ ok: true, status: 200, data: {} })

    const result = await searchDocuments({ words: 'claim rules', sections: 3, limit: 10, offset: 20 })

    expect(searchApiClient.request).toHaveBeenCalledWith('/v1/search', {
      query: { q: 'claim rules', group: 'document', sections: 3, limit: 10, offset: 20 }
    })
    expect(result).toEqual({ ok: true, status: 200, data: {} })
  })
})
