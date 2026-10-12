import { resolveAnchors, splitIntoSections } from '../../../src/services/guide-sections.js'

describe('splitIntoSections', () => {
  test('splits at the shallowest heading and drops the title', () => {
    const markdown = [
      '# Guide title',
      '',
      '## 1 Overview',
      '',
      'Overview text.',
      '',
      '### 1.1 Detail',
      '',
      '- one',
      '- two',
      '',
      '## 2 Assign case',
      '',
      'Assign text.'
    ].join('\n')

    expect(splitIntoSections(markdown)).toEqual([
      {
        id: 'section-1',
        title: '1 Overview',
        slug: '1-overview',
        headingIds: ['11-detail'],
        subheadings: [{ title: '1.1 Detail', slug: '11-detail' }],
        markdown: 'Overview text.\n\n### 1.1 Detail\n\n- one\n- two'
      },
      {
        id: 'section-2',
        title: '2 Assign case',
        slug: '2-assign-case',
        headingIds: [],
        subheadings: [],
        markdown: 'Assign text.'
      }
    ])
  })

  test('puts text before the first heading in an Introduction section', () => {
    const sections = splitIntoSections('Some preface.\n\n## First\n\nBody.')

    expect(sections.map(section => section.title)).toEqual(['Introduction', 'First'])
    expect(sections[0].markdown).toBe('Some preface.')
  })

  test('has no Introduction when nothing comes before the first heading', () => {
    const sections = splitIntoSections('# Title\n\n## First\n\nBody.')

    expect(sections.map(section => section.title)).toEqual(['First'])
  })

  test('keeps a section that has a heading but no text', () => {
    expect(splitIntoSections('## Empty\n\n## Next\n\nBody.')).toEqual([
      { id: 'section-1', title: 'Empty', slug: 'empty', headingIds: [], subheadings: [], markdown: '' },
      { id: 'section-2', title: 'Next', slug: 'next', headingIds: [], subheadings: [], markdown: 'Body.' }
    ])
  })

  test('is one Introduction section when there are no headings', () => {
    expect(splitIntoSections('Just text.')).toEqual([
      { id: 'section-1', title: 'Introduction', slug: null, headingIds: [], subheadings: [], markdown: 'Just text.' }
    ])
  })

  test('keeps a title that is not alone as a section heading', () => {
    const sections = splitIntoSections('# One\n\ntext\n\n# Two\n\nmore')

    expect(sections.map(section => section.title)).toEqual(['One', 'Two'])
  })

  test('uses the shallowest level when the first heading is deeper', () => {
    const sections = splitIntoSections('### Deep\n\ntext\n\n## Shallow\n\nmore')

    expect(sections.map(section => section.title)).toEqual(['Introduction', 'Shallow'])
    expect(sections[0].markdown).toContain('### Deep')
  })

  test('titles a section with its heading text, without formatting', () => {
    const [section] = splitIntoSections('## Use **bold** and [a link](#x)\n\ntext')

    expect(section.title).toBe('Use bold and a link')
  })

  test('does not split on headings inside code fences', () => {
    const sections = splitIntoSections('## A\n\n```\n## not a heading\n```\n\n## B\n\ntext')

    expect(sections.map(section => section.title)).toEqual(['A', 'B'])
  })

  test.each([[''], [null], [undefined], ['   \n\n']])('has no sections for %j', (markdown) => {
    expect(splitIntoSections(markdown)).toEqual([])
  })

  describe('subheadings', () => {
    test('are the headings one level below the section, not deeper ones', () => {
      const [section] = splitIntoSections('## 3 Work\n\n### 3.1 First\n\ntext\n\n#### 3.1.1 Deeper\n\n### 3.2 **Second**')

      expect(section.subheadings).toEqual([
        { title: '3.1 First', slug: '31-first' },
        { title: '3.2 Second', slug: '32-second' }
      ])
      expect(section.headingIds).toHaveLength(3)
    })
  })

  describe('anchors', () => {
    test('are the heading text lower-cased, without punctuation, spaces as hyphens', () => {
      const [section] = splitIntoSections(
        '## 3.3 Land is above (inside/within) or below (outside) the line.\n\n### Under_score & Ünïcode'
      )

      expect(section.slug).toBe('33-land-is-above-insidewithin-or-below-outside-the-line')
      expect(section.headingIds).toEqual(['under_score--ünïcode'])
    })

    test('number a repeated heading, counting the title that is dropped', () => {
      const sections = splitIntoSections('# Same\n\n## Same\n\ntext\n\n## Same\n\nmore\n\n### Same')

      expect(sections.map(section => section.slug)).toEqual(['same-1', 'same-2'])
      expect(sections[1].headingIds).toEqual(['same-3'])
    })

    test('have no slug for an Introduction made of text before the first heading', () => {
      const [intro] = splitIntoSections('Preface.\n\n## A')

      expect(intro.slug).toBeNull()
    })
  })
})

describe('resolveAnchors', () => {
  const sections = splitIntoSections([
    '## 1 One',
    '',
    'Go to [2 Two](#2-two), [2.1 Deep](#21-deep), [1 One](#1-one) or [elsewhere](#nowhere).',
    '',
    '## 2 Two',
    '',
    '### 2.1 Deep',
    '',
    'Back to [1 One](#1-one). Also [a site](https://example.com/#2-two) and [an image](a.png).'
  ].join('\n'))

  const resolved = resolveAnchors(sections, page => `/guides/g?page=${page}`)

  test('point a link at the page with the heading', () => {
    expect(resolved[0].markdown).toContain('[2 Two](/guides/g?page=2#2-two)')
    expect(resolved[0].markdown).toContain('[2.1 Deep](/guides/g?page=2#21-deep)')
    expect(resolved[1].markdown).toContain('[1 One](/guides/g?page=1#1-one)')
  })

  test('leave a link to a heading on the same page', () => {
    expect(resolved[0].markdown).toContain('[1 One](#1-one)')
  })

  test('leave a link to anything that is not a heading of the guide', () => {
    expect(resolved[0].markdown).toContain('[elsewhere](#nowhere)')
    expect(resolved[1].markdown).toContain('[a site](https://example.com/#2-two)')
    expect(resolved[1].markdown).toContain('[an image](a.png)')
  })

  test('do not change the sections it is given', () => {
    expect(sections[0].markdown).toContain('[2 Two](#2-two)')
  })
})
