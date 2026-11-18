import { pageOf } from './page.js'

describe('toSendInOrder', () => {
  test('takes only the fields a browser sends: not a disabled one, nor a box left unticked', () => {
    const page = pageOf(`<main><form method="post" action="/pin-order">
      <input type="hidden" name="order" value="first">
      <input type="hidden" name="order" value="disabled" disabled>
      <input type="checkbox" name="order" value="unticked">
      <input type="checkbox" name="order" value="ticked" checked>
      <button type="submit">Move down</button>
    </form></main>`)

    expect(page.getByRole('button', { name: 'Move down' }).form).toSendInOrder('order', ['first', 'ticked'])
  })
})
