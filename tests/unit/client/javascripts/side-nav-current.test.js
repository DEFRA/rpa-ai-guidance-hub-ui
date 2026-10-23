import { currentNavHref } from '../../../../src/client/javascripts/side-nav-current.js'

const HREFS = ['/hub', '/hub#recently-opened', '/hub#pinned', '/hub#bookmarked-guides', '/hub#awaiting-my-review', '/create-guidance/upload-guide']

describe('#currentNavHref', () => {
  test.each([
    ['#pinned', '/hub#pinned'],
    ['#bookmarked-guides', '/hub#bookmarked-guides'],
    ['#recently-opened', '/hub#recently-opened']
  ])('is the list the hub shows for %s', (hash, href) => {
    expect(currentNavHref('/hub', hash, HREFS)).toBe(href)
  })

  test.each([[''], ['#all-guides'], ['#somewhere-else']])('is the hub itself for %j', (hash) => {
    expect(currentNavHref('/hub', hash, HREFS)).toBe('/hub')
  })

  test('is only ever one link, so the hub is never marked twice', () => {
    expect(HREFS.filter((href) => href === currentNavHref('/hub', '', HREFS))).toEqual(['/hub'])
  })

  test('leaves other pages as the server marked them', () => {
    expect(currentNavHref('/create-guidance/upload-guide', '#pinned', HREFS)).toBeNull()
  })
})
