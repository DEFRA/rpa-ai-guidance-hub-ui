// @vitest-environment jsdom
import nock from 'nock'

import {
  GAP_MS,
  PreferenceSaver,
  savePreferences
} from '../../../../src/client/javascripts/preferences.js'

// What each request to POST /preferences carried, in the order they came.
let received

/**
 * Answers requests to POST /preferences with `status` once `held` settles,
 * noting what each carried. nock's own delay runs on real time, which the
 * fake timers here would not move.
 *
 * @param {number} status
 * @param {Promise<void>} [held] - Until it settles, the request is on its way
 * @returns {nock.Scope}
 */
function preferencesAnswer (status, held = Promise.resolve()) {
  const scope = nock(window.location.origin)
    .post('/preferences')
    .reply(() => held.then(() => [status]))

  scope.on('request', (_req, _interceptor, body) => {
    received.push(Object.fromEntries(new URLSearchParams(body)))
  })

  return scope
}

/**
 * @returns {{held: Promise<void>, release: Function}} A request's answer
 *   held until `release` is called
 */
function holdAnswer () {
  let release
  const held = new Promise(resolve => { release = resolve })

  return { held, release }
}

// Real turns of the event loop for a request to reach nock or its answer to
// come back, which takes more for a request that does not get through.
// setImmediate is not faked.
const TURNS = 50

/**
 * @returns {Promise<void>}
 */
async function settle () {
  for (let turn = 0; turn < TURNS; turn++) {
    await new Promise(resolve => setImmediate(resolve))
  }
}

/**
 * @param {number} ms - Fake time to let pass, letting requests reach nock
 *   and answer
 * @returns {Promise<void>}
 */
async function pass (ms) {
  await settle()
  await vi.advanceTimersByTimeAsync(ms)
  await settle()
}

beforeAll(() => {
  nock.disableNetConnect()
})

afterAll(() => {
  nock.enableNetConnect()
})

beforeEach(() => {
  received = []

  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
})

afterEach(async () => {
  // A request still on its way reaches this test's nock, not the next's.
  await settle()

  vi.useRealTimers()

  nock.cleanAll()
})

test('sends a change straight away', async () => {
  preferencesAnswer(204)

  new PreferenceSaver().save({ sideNavWidth: 300 })
  await pass(0)

  expect(received).toEqual([{ sideNavWidth: '300' }])
})

test('sends changes made while one is on its way after it, keeping only the latest of each', async () => {
  const answer = holdAnswer()
  preferencesAnswer(204, answer.held)
  preferencesAnswer(204)

  const saver = new PreferenceSaver()

  saver.save({ sideNavPinnedCollapsed: true })
  await pass(0)

  saver.save({ sideNavPinnedCollapsed: false })
  saver.save({ sideNavWidth: 300 })
  saver.save({ sideNavPinnedCollapsed: true })
  saver.save({ sideNavPinnedCollapsed: false })
  await pass(GAP_MS * 5)

  expect(received).toEqual([{ sideNavPinnedCollapsed: 'true' }])

  answer.release()
  await pass(0)

  expect(received).toEqual([
    { sideNavPinnedCollapsed: 'true' },
    { sideNavPinnedCollapsed: 'false', sideNavWidth: '300' }
  ])
})

test('leaves at least the gap between one request starting and the next', async () => {
  preferencesAnswer(204).persist()

  const saver = new PreferenceSaver()

  saver.save({ sideNavWidth: 300 })
  await pass(0)

  saver.save({ sideNavWidth: 320 })
  await pass(GAP_MS - 1)

  expect(received).toEqual([{ sideNavWidth: '300' }])

  await pass(1)

  expect(received).toEqual([{ sideNavWidth: '300' }, { sideNavWidth: '320' }])
})

test('sends a request a gap at most, however fast the changes come', async () => {
  preferencesAnswer(204).persist()

  const saver = new PreferenceSaver()

  for (let tick = 0; tick < 100; tick++) {
    saver.save({ contentsWidth: 240 + tick })
    await pass(GAP_MS / 10)
  }

  // 100 changes over ten gaps: one request at once, then one each gap.
  expect(received).toHaveLength(11)
})

test('does not send a preference again as it was last kept', async () => {
  preferencesAnswer(204).persist()

  const saver = new PreferenceSaver()

  saver.save({ sideNavWidth: 300 })
  await pass(GAP_MS)

  saver.save({ sideNavWidth: 300 })
  await pass(GAP_MS)

  expect(received).toEqual([{ sideNavWidth: '300' }])
})

test('goes on sending after one cannot be kept, sending it again if asked', async () => {
  preferencesAnswer(503)
  preferencesAnswer(204)

  const saver = new PreferenceSaver()

  saver.save({ sideNavWidth: 300 })
  await pass(GAP_MS)

  saver.save({ sideNavWidth: 300 })
  await pass(GAP_MS)

  expect(received).toEqual([{ sideNavWidth: '300' }, { sideNavWidth: '300' }])
})

test('goes on sending after one does not get through', async () => {
  nock(window.location.origin)
    .post('/preferences')
    .replyWithError('The network is down')

  preferencesAnswer(204)

  const saver = new PreferenceSaver()

  saver.save({ sideNavWidth: 300 })
  await pass(GAP_MS)

  saver.save({ sideNavWidth: 300 })
  await pass(GAP_MS)

  // A request that does not get through takes more turns than settle()
  // gives on a slow machine, so wait for the next to arrive.
  await vi.waitFor(() => expect(received).toEqual([{ sideNavWidth: '300' }]))
})

test('sends a change still waiting as the user leaves the page', async () => {
  const answer = holdAnswer()
  preferencesAnswer(204, answer.held)
  preferencesAnswer(204)

  const saver = new PreferenceSaver()

  saver.save({ sideNavWidth: 300 })
  await pass(0)

  saver.save({ sideNavWidth: 320 })
  window.dispatchEvent(new Event('pagehide'))
  await pass(0)

  expect(received).toEqual([{ sideNavWidth: '300' }, { sideNavWidth: '320' }])

  answer.release()
})

test('sends the changes of every script on the page through one saver, one at a time', async () => {
  const answer = holdAnswer()
  preferencesAnswer(204, answer.held)
  preferencesAnswer(204)

  savePreferences({ sideNavWidth: 300 })
  await pass(0)

  savePreferences({ sideNavPinnedCollapsed: true })
  await pass(GAP_MS)

  expect(received).toEqual([{ sideNavWidth: '300' }])

  answer.release()
  await pass(0)

  expect(received).toEqual([
    { sideNavWidth: '300' },
    { sideNavPinnedCollapsed: 'true' }
  ])
})
