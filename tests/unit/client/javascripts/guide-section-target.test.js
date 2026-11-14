// @vitest-environment jsdom
import { sectionTarget } from '../../../../src/client/javascripts/guide-section-target.js'

const GUIDE = '/guides/guide-1'

describe('sectionTarget', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <nav>
        <p><a class="app-guide-contents__section-link" data-guide-contents-target="assign-case" data-guide-contents-section="assign-case" href="${GUIDE}?section=assign-case">Assign case</a></p>
        <ol>
          <li><a class="app-guide-contents__link" data-guide-contents-target="help-1" data-guide-contents-section="help" href="#help-1">Help</a></li>
          <li><a class="app-guide-contents__link" data-guide-contents-target="21-check" data-guide-contents-section="21-check" href="#21-check">2.1 Check</a></li>
        </ol>
      </nav>
      <h2 id="assign-case">Assign case</h2><h3 id="help-1">Help</h3><h3 id="21-check">2.1 Check</h3>`
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  test('is the heading a copied address names, found by the anchor the stepper names it by', () => {
    expect(sectionTarget({ search: '?section=21-check', hash: '' }, document)).toBe(document.getElementById('21-check'))
  })

  test('is the heading on the page where that anchor differs from the hub\'s', () => {
    expect(sectionTarget({ search: '?section=help', hash: '' }, document)).toBe(document.getElementById('help-1'))
  })

  test('is none where the address has a fragment, which says where to go', () => {
    expect(sectionTarget({ search: '?section=21-check', hash: '#help-1' }, document)).toBeNull()
  })

  test('is none for a section\'s own heading, which is the start of its page, or for no section', () => {
    expect(sectionTarget({ search: '?section=assign-case', hash: '' }, document)).toBeNull()
    expect(sectionTarget({ search: '', hash: '' }, document)).toBeNull()
  })
})
