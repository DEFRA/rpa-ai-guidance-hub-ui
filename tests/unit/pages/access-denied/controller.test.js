import { getRoleRequired } from '../../../../src/pages/access-denied/controller.js'

describe('#getRoleRequired', () => {
  test('gives the page the missing roles as a list, for it to join and count', async () => {
    const request = { yar: { flash: vi.fn(() => ({ missingRoles: ['Maintainer'], reason: 'upload a new guide' })) } }
    const h = { view: vi.fn(() => ({ code: vi.fn() })) }

    await getRoleRequired(request, h)

    expect(h.view).toHaveBeenCalledWith('access-denied/role-required.njk', expect.objectContaining({
      missingRoles: ['Maintainer'],
      reason: 'upload a new guide'
    }))
  })
})
