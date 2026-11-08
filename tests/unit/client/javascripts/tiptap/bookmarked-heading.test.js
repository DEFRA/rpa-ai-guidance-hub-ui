// @vitest-environment jsdom
import { Editor, getSchema } from '@tiptap/core'

import { extensionsWithBookmarks, headingsBefore } from '../../../../../src/client/javascripts/tiptap/bookmarked-heading.js'
import { EXTENSIONS } from '../../../../../src/client/javascripts/tiptap/extensions.js'

describe('headingsBefore', () => {
  const schema = getSchema(EXTENSIONS)
  const heading = text => ({ type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text }] })
  const doc = schema.nodeFromJSON({
    type: 'doc',
    content: [
      heading('One'),
      { type: 'paragraph', content: [{ type: 'text', text: 'Text.' }] },
      { type: 'blockquote', content: [heading('Quoted')] },
      heading('Three')
    ]
  })
  const positions = []

  doc.descendants((node, position) => {
    if (node.type.name === 'heading') {
      positions.push(position)
    }
  })

  test('counts the headings before each, those in quotes too, as the page gives them their bookmarks', () => {
    expect(positions.map(position => headingsBefore(doc, position))).toEqual([0, 1, 2])
  })
})

describe('the headings the viewer draws', () => {
  const heading = text => ({ type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text }] })

  test('each have their own bookmark after them, those in quotes too, and once bookmarked say to which cases', () => {
    const element = document.createElement('div')
    const editor = new Editor({
      element,
      extensions: extensionsWithBookmarks(EXTENSIONS, [
        { href: '/guides/g/bookmark?section=one', bookmarkedTo: 'Case W1234567' },
        { href: '/guides/g/bookmark?section=quoted', bookmarkedTo: null }
      ]),
      content: { type: 'doc', content: [heading('One'), { type: 'blockquote', content: [heading('Quoted')] }] },
      editable: false
    })
    const [one, quoted] = element.querySelectorAll('.app-guide-heading')

    expect(one.querySelector('h3').textContent).toBe('One')
    expect(one.querySelector('.app-guide-section-bookmark').getAttribute('href')).toBe('/guides/g/bookmark?section=one')
    expect(one.querySelector('.app-guide-section-bookmark').classList.contains('app-guide-section-bookmark--active')).toBe(true)
    expect(one.querySelector('.app-guide-section-bookmarked').textContent).toBe('Bookmarked to Case W1234567')
    expect(quoted.closest('blockquote')).not.toBeNull()
    expect(quoted.querySelector('.app-guide-section-bookmark').getAttribute('href')).toBe('/guides/g/bookmark?section=quoted')
    expect(quoted.querySelector('.app-guide-section-bookmarked')).toBeNull()

    editor.destroy()
  })
})

describe('extensionsWithBookmarks', () => {
  test('gives the headings their bookmarks, and leaves every other extension as it is', () => {
    const extensions = extensionsWithBookmarks(EXTENSIONS, [{ href: '/b', bookmarkedTo: null }])

    expect(extensions.map(extension => extension.name)).toEqual(EXTENSIONS.map(extension => extension.name))
    expect(extensions.find(extension => extension.name === 'heading').options.bookmarks).toEqual([{ href: '/b', bookmarkedTo: null }])
  })

  test('leaves them all as they are without bookmarks, as for the editor', () => {
    expect(extensionsWithBookmarks(EXTENSIONS, [])).toBe(EXTENSIONS)
  })
})
