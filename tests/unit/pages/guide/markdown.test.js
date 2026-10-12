import { jsonScript, renderMarkdownFallback } from '../../../../src/pages/guide/markdown.js'

describe('renderMarkdownFallback', () => {
  test('renders headings, lists and emphasis', () => {
    const html = renderMarkdownFallback('### Heading\n\n- one\n- **two**')

    expect(html).toContain('<h3>Heading</h3>')
    expect(html).toContain('<li>one</li>')
    expect(html).toContain('<strong>two</strong>')
  })

  test('escapes raw HTML rather than passing it through', () => {
    const html = renderMarkdownFallback('<script>alert(1)</script>\n\n<u onclick="x">no</u>')

    expect(html).not.toContain('<script>')
    expect(html).not.toContain('<u onclick')
    expect(html).toContain('&lt;script&gt;')
  })

  test('keeps bare formatting tags', () => {
    const html = renderMarkdownFallback('Use <u>only</u> with <b>this</b><br>and <br/>that')

    expect(html).toContain('<u>only</u>')
    expect(html).toContain('<b>this</b><br>and <br/>that')
  })

  test.each([
    ['javascript:alert(1)'],
    ['data:text/html;base64,AAAA'],
    ['//evil.example']
  ])('drops the unsafe link address %s but keeps its text', (href) => {
    const html = renderMarkdownFallback(`[click me](${href})`)

    expect(html).toContain('click me')
    expect(html).not.toContain('<a')
    expect(html).not.toContain(href)
  })

  test.each([
    ['https://example.com/page'],
    ['mailto:someone@example.com'],
    ['#11-eligibility'],
    ['/guides/guide-1']
  ])('keeps the safe link address %s', (href) => {
    expect(renderMarkdownFallback(`[go](${href})`)).toContain(`<a href="${href}">go</a>`)
  })

  test('keeps an image from the guide and drops an unsafe one', () => {
    const safe = renderMarkdownFallback('![alt](/guides/guide-1/assets/abc.png)')
    const unsafe = renderMarkdownFallback('![alt](javascript:alert(1))')

    expect(safe).toContain('<img src="/guides/guide-1/assets/abc.png" alt="alt" loading="lazy">')
    expect(unsafe).not.toContain('<img')
    expect(unsafe).not.toContain('javascript')
  })

  test('escapes quotes in a title and alt text', () => {
    const html = renderMarkdownFallback('[go](/x "a \\"quoted\\" title")\n\n![a"b](/y.png)')

    expect(html).not.toMatch(/title="[^"]*"[^ >]*"/)
    expect(html).toContain('alt="a&quot;b"')
  })

  test('gives the headings the ids it is given, in order, escaped', () => {
    const html = renderMarkdownFallback('### One\n\ntext\n\n#### Two\n\n### Three', ['one', 'a"b'])

    expect(html).toContain('<h3 id="one">One</h3>')
    expect(html).toContain('<h4 id="a&quot;b">Two</h4>')
    expect(html).toContain('<h3>Three</h3>')
  })

  describe('coloured spans', () => {
    test.each([['red'], ['blue']])('colours text marked .%s, by class', (colour) => {
      const html = renderMarkdownFallback(`Complete the parts in [${colour}]{.${colour}}.`)

      expect(html).toContain(`<span class="markdown-preview__text--${colour}">${colour}</span>`)
      expect(html).not.toContain('{.')
      expect(html).not.toContain('style=')
    })

    test('keeps formatting and escapes raw HTML inside the span', () => {
      const html = renderMarkdownFallback('[**bold** <s>raw</s> &lt;input name&gt;]{.red}')

      expect(html).toContain('<span class="markdown-preview__text--red"><strong>bold</strong> &lt;s&gt;raw&lt;/s&gt; &lt;input name&gt;</span>')
    })

    test('works inside a quote and a list', () => {
      const html = renderMarkdownFallback('> Version used:[&lt;version&gt;]{.red}\n\n- fill in [this]{.blue}')

      expect(html).toContain('<blockquote>')
      expect(html).toContain('markdown-preview__text--red')
      expect(html).toContain('<li>fill in <span class="markdown-preview__text--blue">this</span></li>')
    })

    test('leaves a colour that is not in the palette as the text it is', () => {
      const html = renderMarkdownFallback('[pink]{.pink}')

      expect(html).not.toContain('<span')
      expect(html).toContain('[pink]{.pink}')
    })

    test('does not take a link for a coloured span', () => {
      const html = renderMarkdownFallback('[a link](/x) and [text]{.red}')

      expect(html).toContain('<a href="/x">a link</a>')
      expect(html).toContain('<span class="markdown-preview__text--red">text</span>')
    })

    test('cannot be given a class by the guide', () => {
      const html = renderMarkdownFallback('[x]{.red" onmouseover="alert(1)}')

      expect(html).not.toContain('onmouseover="')
    })
  })

  test.each([[''], [null], [undefined]])('renders %j as nothing', (markdown) => {
    expect(renderMarkdownFallback(markdown)).toBe('')
  })
})

describe('jsonScript', () => {
  test('round-trips the value', () => {
    const value = '## Heading\n\n"quoted" & more'

    expect(JSON.parse(jsonScript(value))).toBe(value)
  })

  test('cannot close the script element or open a comment', () => {
    const json = jsonScript('</script><script>alert(1)</script><!--')

    expect(json).not.toContain('<')
    expect(JSON.parse(json)).toBe('</script><script>alert(1)</script><!--')
  })
})
