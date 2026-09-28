import { StartOverViewModel } from '../../../../../src/pages/create-guidance/start-over/view-models.js'

describe('StartOverViewModel', () => {
  test('carries the cancel url through to the view', () => {
    const viewModel = new StartOverViewModel({ cancelUrl: '/create-guidance/upload-guide/metadata' })

    expect(viewModel.cancelUrl).toBe('/create-guidance/upload-guide/metadata')
    expect(viewModel.pageTitle).toBe('Start over')
    expect(viewModel.page).toBe('start over')
  })

  test('defaults the summary cards to null when none are given', () => {
    const viewModel = new StartOverViewModel({ cancelUrl: '/create-guidance/upload-guide/metadata' })

    expect(viewModel.guideDetailsCard).toBeNull()
    expect(viewModel.ownerPurposeCard).toBeNull()
  })

  test('carries the summary cards through to the view', () => {
    const guideDetailsCard = { title: { text: "The guide's details" }, rows: [] }
    const ownerPurposeCard = { title: { text: 'Owner and purpose' }, rows: [] }

    const viewModel = new StartOverViewModel({
      cancelUrl: '/create-guidance/upload-guide/metadata',
      guideDetailsCard,
      ownerPurposeCard
    })

    expect(viewModel.guideDetailsCard).toBe(guideDetailsCard)
    expect(viewModel.ownerPurposeCard).toBe(ownerPurposeCard)
  })
})
