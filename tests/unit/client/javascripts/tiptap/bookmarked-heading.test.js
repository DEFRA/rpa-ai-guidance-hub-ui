import { getSchema } from '@tiptap/core'

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

describe('extensionsWithBookmarks', () => {
  test('draws headings with their bookmarks, and leaves every other extension as it is', () => {
    const extensions = extensionsWithBookmarks(EXTENSIONS, [{ href: '/b', bookmarkedTo: null }])

    expect(extensions.map(extension => extension.name)).toEqual(EXTENSIONS.map(extension => extension.name))
    expect(extensions.find(extension => extension.name === 'heading').options.bookmarks).toEqual([{ href: '/b', bookmarkedTo: null }])
  })

  test('leaves them all as they are without bookmarks, as for the editor', () => {
    expect(extensionsWithBookmarks(EXTENSIONS, [])).toBe(EXTENSIONS)
  })
})
