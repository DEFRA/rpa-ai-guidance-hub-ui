// @vitest-environment jsdom
import { initPolling } from '../../../../src/client/javascripts/status-poll.js'

describe('initPolling', () => {
  let timeout

  beforeEach(() => {
    vi.useFakeTimers()
    document.body.innerHTML = '<div data-poll-url="/status" data-redirect-url="/done"><p data-progress-waiting></p></div>'
    // Stands in for the request's time running out, which the browser keeps itself.
    timeout = new AbortController()
    vi.spyOn(AbortSignal, 'timeout').mockReturnValue(timeout.signal)
    vi.stubGlobal('fetch', vi.fn((_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason))
    })))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  test('gives up a status request that has not answered in 3 seconds, and polls again', async () => {
    initPolling()
    await vi.advanceTimersByTimeAsync(1000)

    expect(window.fetch).toHaveBeenCalledTimes(1)
    expect(AbortSignal.timeout).toHaveBeenCalledWith(3000)
    expect(window.fetch.mock.calls[0][1].signal).toBe(timeout.signal)

    timeout.abort()
    await vi.advanceTimersByTimeAsync(5000)

    expect(window.fetch).toHaveBeenCalledTimes(2)
  })
})
