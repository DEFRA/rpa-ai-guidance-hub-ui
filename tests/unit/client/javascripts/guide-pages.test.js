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
            <div data-guide-page="1"></div>
            <div data-guide-page="2" hidden="until-found"></div>
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

    expect(returnTos).toEqual([`${GUIDE_URL}?page=2`, `${GUIDE_URL}?page=2`, `${GUIDE_URL}?page=2`])
  })
})
