// @vitest-environment jsdom
import { initGuidePages } from '../../../../src/client/javascripts/guide-pages.js'

describe('a guide\'s page revealed by the browser\'s find in page', () => {
  const GUIDE_URL = '/guides/guide-1'

  /** A two-page guide in the layout, each part with a form that comes back to it. */
  function render () {
    const comesBack = `<form method="post"><input type="hidden" name="returnTo" value="${GUIDE_URL}"></form>`

    document.body.innerHTML = `
      ${comesBack}
      <div class="app-layout">
        <div class="app-layout__nav">${comesBack}</div>
        <div class="app-layout__main">
          <div class="app-shell">
            ${comesBack}
            <div data-guide-page="1" data-guide-page-href="${GUIDE_URL}"></div>
            <div data-guide-page="2" data-guide-page-href="${GUIDE_URL}?section=assign-case" hidden="until-found"></div>
          </div>
        </div>
      </div>`
  }

  beforeEach(() => {
    window.history.replaceState(null, '', GUIDE_URL)
    render()
    initGuidePages()
  })

  test('is where every form on the page comes back to, the side navigation\'s as well as the guide\'s', () => {
    document.querySelector('[data-guide-page="2"]').dispatchEvent(new window.Event('beforematch'))

    const returnTos = Array.from(document.querySelectorAll('input[name="returnTo"]')).map((input) => input.value)

    expect(returnTos).toEqual(Array(3).fill(`${GUIDE_URL}?section=assign-case`))
  })

  test('names the page in the address by its section', () => {
    document.querySelector('[data-guide-page="2"]').dispatchEvent(new window.Event('beforematch'))

    expect(window.location.search).toBe('?section=assign-case')
  })

  test('names a first page without a heading of its own by the guide\'s address alone', () => {
    window.history.replaceState(null, '', `${GUIDE_URL}?section=assign-case`)

    document.querySelector('[data-guide-page="1"]').dispatchEvent(new window.Event('beforematch'))

    expect(window.location.search).toBe('')
  })
})
