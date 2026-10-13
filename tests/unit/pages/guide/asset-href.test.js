import { guideAssetHref } from '../../../../src/pages/guide/asset-href.js'

const HASH = '7325bba64eff8125faf047e2fd3d2719acc4e0b68ff0362cbf63f212fa27b00e'

describe('guideAssetHref', () => {
  test('points an asset at the UI\'s asset route', () => {
    expect(guideAssetHref(`../assets/${HASH}.png`, 'guide 1'))
      .toBe(`/guides/guide%201/assets/${HASH}.png`)
  })

  test.each([
    ['x/y.png', 'x%2Fy.png'],
    ['a.png?x=1', 'a.png%3Fx%3D1'],
    ['a.png#frag', 'a.png%23frag'],
    ['a%2Fb.png', 'a%252Fb.png'],
    ['a b.png', 'a%20b.png']
  ])('keeps %j to a single asset name', (name, encoded) => {
    expect(guideAssetHref(`../assets/${name}`, 'g')).toBe(`/guides/g/assets/${encoded}`)
  })

  test.each([
    '../assets/',
    '../assets/.',
    '../assets/..',
    `../../assets/${HASH}.png`,
    `../ASSETS/${HASH}.png`,
    `/assets/${HASH}.png`,
    `assets/${HASH}.png`,
    `./assets/${HASH}.png`,
    `https://example.com/../assets/${HASH}.png`,
    'javascript:alert(1)',
    'https://example.com',
    '#section',
    ''
  ])('leaves %j alone', (href) => {
    expect(guideAssetHref(href, 'g')).toBe(href)
  })
})
