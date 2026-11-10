import { guideFrom, pageFrom, searchHref, searchPagination } from '../../../../src/pages/hub/search.js'

describe('#pageFrom', () => {
  test.each([
    [{ page: '3' }, 3],
    [{ page: '1' }, 1],
    [{}, 1],
    [{ page: '0' }, 1],
    [{ page: '-2' }, 1],
    [{ page: '2.5' }, 1],
    [{ page: 'two' }, 1],
    [{ page: ['2', '3'] }, 1],
    [{ page: '99999999999999999999' }, 1]
  ])('gives %j as page %i', (query, page) => {
    expect(pageFrom(query)).toBe(page)
  })
})

const GUIDE = '7c9e6679-7425-40de-944b-e07fc1f90ae7'

describe('#guideFrom', () => {
  test.each([
    [{ guide: GUIDE }, GUIDE],
    [{ guide: GUIDE.toUpperCase() }, GUIDE],
    [{}, null],
    [{ guide: '' }, null],
    [{ guide: 'not-a-guide' }, null],
    [{ guide: `${GUIDE}/../x` }, null],
    [{ guide: [GUIDE, GUIDE] }, null]
  ])('gives %j as %s', (query, guide) => {
    expect(guideFrom(query)).toBe(guide)
  })
})

describe('#searchHref', () => {
  test('keeps the words, and the page only when it is not the first', () => {
    expect(searchHref({ words: 'claim rules', page: 1 })).toBe('/hub?q=claim+rules')
    expect(searchHref({ words: 'claim & rules', page: 4 })).toBe('/hub?q=claim+%26+rules&page=4')
  })

  test('keeps the guide searched inside, when there is one', () => {
    expect(searchHref({ words: 'claim', guide: GUIDE })).toBe(`/hub?q=claim&guide=${GUIDE}`)
    expect(searchHref({ words: 'claim', guide: GUIDE, page: 2 })).toBe(`/hub?q=claim&guide=${GUIDE}&page=2`)
  })
})

describe('#searchPagination', () => {
  test('has none when the results fit on one page', () => {
    expect(searchPagination({ words: 'claim', page: 1, total: 10 })).toBeNull()
    expect(searchPagination({ words: 'claim', page: 1, total: 0 })).toBeNull()
  })

  test('has none when there are too many matches to give', () => {
    expect(searchPagination({ words: 'claim', page: 1, total: 1500, tooManyMatches: true })).toBeNull()
  })

  test('has no previous page on the first, and a next one', () => {
    const pagination = searchPagination({ words: 'claim', page: 1, total: 25 })

    expect(pagination).toEqual({
      previous: null,
      next: { href: '/hub?q=claim&page=2' },
      items: [
        { number: 1, href: '/hub?q=claim', current: true },
        { number: 2, href: '/hub?q=claim&page=2', current: false },
        { number: 3, href: '/hub?q=claim&page=3', current: false }
      ]
    })
  })

  test('has no next page on the last', () => {
    const pagination = searchPagination({ words: 'claim', page: 3, total: 25 })

    expect(pagination.previous).toEqual({ href: '/hub?q=claim&page=2' })
    expect(pagination.next).toBeNull()
  })

  test('numbers the first, the last and the current page\'s neighbours, leaving out the rest', () => {
    const pagination = searchPagination({ words: 'claim', page: 5, total: 100 })

    expect(pagination.items.map((item) => item.ellipsis ? '…' : item.number)).toEqual([1, '…', 4, 5, 6, '…', 10])
  })

  test('keeps the guide searched inside on every page', () => {
    const pagination = searchPagination({ words: 'claim', guide: GUIDE, page: 1, total: 25 })

    expect(pagination.next).toEqual({ href: `/hub?q=claim&guide=${GUIDE}&page=2` })
  })

  test('goes back to the last page from a page beyond it', () => {
    const pagination = searchPagination({ words: 'claim', page: 9, total: 25 })

    expect(pagination.previous).toEqual({ href: '/hub?q=claim&page=3' })
    expect(pagination.next).toBeNull()
  })
})
