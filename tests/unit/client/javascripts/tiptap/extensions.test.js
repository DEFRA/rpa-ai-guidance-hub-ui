// @vitest-environment jsdom
import { within } from '@testing-library/dom'
import { getSchema } from '@tiptap/core'
import { DOMSerializer } from '@tiptap/pm/model'

import { EXTENSIONS } from '../../../../../src/client/javascripts/tiptap/extensions.js'

/**
 * A link to `href` as the viewer draws it, with `text` as its words.
 *
 * @param {string} href
 * @param {string} [text]
 * @returns {ReturnType<typeof within>} The page's queries, the link alone on it
 */
function viewerLink (href, text = 'go') {
  const { link } = getSchema(EXTENSIONS).marks
  const { dom, contentDOM } = DOMSerializer.renderSpec(document, link.spec.toDOM(link.create({ href }), true))

  contentDOM.append(text)
  document.body.replaceChildren(dom)

  return within(document.body)
}

describe('the viewer\'s links', () => {
  test.each([
    'https://www.gov.uk/x',
    '//www.gov.uk/x'
  ])('open a link to another site, %s, in a new tab, saying so to a screen reader', (href) => {
    const link = viewerLink(href, 'GOV.UK').getByRole('link', { name: /^GOV\.UK ?\(opens in new tab\)$/ })

    expect(link).toHaveAttribute('href', href)
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  test.each([
    ['a place in the same guide', '#eligibility'],
    ['another guide in the hub', '/guides/guide-2/claim-form'],
    ['an email address', 'mailto:someone@example.com']
  ])('leave a link to %s in the same tab', (_, href) => {
    const link = viewerLink(href).getByRole('link', { name: 'go' })

    expect(link).toHaveAttribute('href', href)
    expect(link).not.toHaveAttribute('target')
  })

  test('do not open a link with an unsafe address in a new tab', () => {
    const link = viewerLink('javascript:alert(1)').getByText('go')

    expect(link).not.toHaveAttribute('target')
    expect(link).not.toHaveAttribute('href', 'javascript:alert(1)')
  })
})
