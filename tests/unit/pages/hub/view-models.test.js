import { HubViewModel } from '../../../../src/pages/hub/view-models.js'

const item = {
  title: 'CS MA Claim - Revenue Options Claim Rule at Signoff 2026',
  href: '/guidance/1',
  lastModified: '20 July 2026',
  version: '1',
  removeHref: '/hub/remove/1'
}

describe('#HubViewModel', () => {
  describe('when no guidance is provided', () => {
    const viewModel = new HubViewModel()

    test.each([
      ['recentlyOpened', 'Recently opened'],
      ['savedGuidance', 'Saved guidance'],
      ['editing', 'Editing'],
      ['awaitingApproval', 'Awaiting approval']
    ])('Should return an empty %s table', (key, heading) => {
      expect(viewModel[key]).toEqual(expect.objectContaining({
        heading,
        isEmpty: true,
        count: 0,
        rows: []
      }))
    })

    test('Should not hint on tables with no hint copy', () => {
      expect(viewModel.editing.hintMessage).toBeNull()
      expect(viewModel.awaitingApproval.hintMessage).toBeNull()
    })
  })

  describe('recentlyOpened and savedGuidance', () => {
    test('Should build a title/lastModified/version/action row, defaulting status to Published', () => {
      const viewModel = new HubViewModel({ recentlyOpened: [item] })

      expect(viewModel.recentlyOpened.rows).toEqual([[
        { type: 'title', text: item.title, href: item.href, statusText: 'Published', statusColour: 'green' },
        { type: 'text', text: item.lastModified },
        { type: 'version', version: item.version, colour: 'green' },
        { type: 'removeAction', text: item.title, href: item.removeHref }
      ]])
    })

    test('Should use a provided status over the Published default', () => {
      const viewModel = new HubViewModel({ savedGuidance: [{ ...item, status: 'Archived' }] })

      expect(viewModel.savedGuidance.rows[0][0]).toEqual(
        expect.objectContaining({ statusText: 'Archived', statusColour: 'green' })
      )
    })

    test('Should count the recently opened items into the hint message', () => {
      const viewModel = new HubViewModel({ recentlyOpened: [item, item] })

      expect(viewModel.recentlyOpened.hintMessage).toBe('Your 2 recently opened guidances')
    })

    test.each([
      ['1', 'green'],
      ['0.5', 'green'],
      ['1.1', 'purple'],
      ['2', 'purple']
    ])('Should tag version %s as %s', (version, colour) => {
      const viewModel = new HubViewModel({ recentlyOpened: [{ ...item, version }] })

      expect(viewModel.recentlyOpened.rows[0][2]).toEqual({ type: 'version', version, colour })
    })
  })

  describe('untrusted hrefs', () => {
    test.each([
      ['javascript: URI', 'javascript:alert(document.cookie)'],
      ['data: URI', 'data:text/html,<script>alert(1)</script>'],
      ['protocol-relative URL', '//evil.example.com'],
      ['backslash protocol-relative URL', '/\\evil.example.com'],
      ['absolute URL', 'https://evil.example.com'],
      ['missing href', undefined]
    ])('Should replace a %s href with "#"', (_, href) => {
      const viewModel = new HubViewModel({ recentlyOpened: [{ ...item, href, removeHref: href }] })

      expect(viewModel.recentlyOpened.rows[0][0].href).toBe('#')
      expect(viewModel.recentlyOpened.rows[0][3].href).toBe('#')
    })

    test('Should keep a same-origin relative href', () => {
      const viewModel = new HubViewModel({ recentlyOpened: [item] })

      expect(viewModel.recentlyOpened.rows[0][0].href).toBe(item.href)
      expect(viewModel.recentlyOpened.rows[0][3].href).toBe(item.removeHref)
    })
  })

  describe('editing', () => {
    test('Should build a title/version/lastModified/action row tagged Draft', () => {
      const viewModel = new HubViewModel({ editing: [item] })

      expect(viewModel.editing.rows).toEqual([[
        { type: 'title', text: item.title, href: item.href, statusText: 'Draft', statusColour: 'grey' },
        { type: 'version', version: item.version, colour: 'green' },
        { type: 'text', text: item.lastModified },
        { type: 'removeAction', text: item.title, href: item.removeHref }
      ]])
    })
  })

  describe('awaitingApproval', () => {
    test('Should build a title/version/publishingChecks/changesRequested row', () => {
      const viewModel = new HubViewModel({
        awaitingApproval: [{ ...item, publishingChecks: 'Broken link', changesRequested: 'Fix heading' }]
      })

      expect(viewModel.awaitingApproval.rows).toEqual([[
        { type: 'title', text: item.title, href: item.href, statusText: 'Awaiting approval', statusColour: 'yellow' },
        { type: 'version', version: item.version, colour: 'green' },
        { type: 'text', text: 'Broken link' },
        { type: 'text', text: 'Fix heading' }
      ]])
    })

    test('Should default missing publishing checks and changes requested', () => {
      const viewModel = new HubViewModel({ awaitingApproval: [item] })

      expect(viewModel.awaitingApproval.rows[0][2]).toEqual({ type: 'text', text: 'No issues' })
      expect(viewModel.awaitingApproval.rows[0][3]).toEqual({ type: 'text', text: 'None' })
    })
  })
})
