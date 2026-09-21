/**
 * Generic progress tracker for ordered, async multi-step processes.
 *
 * Holds only its (static) step definitions — a single instance is safe to build
 * once per domain and reuse across requests, since no per-request state is kept
 * on the instance. Completed-step state is passed in and returned per call.
 */
class ProgressTracker {
  #steps

  /**
   * Create a ProgressTracker
   *
   * @param {Array<Object>} steps - Ordered list of step definitions
   * @param {string} steps[].id - Unique step identifier
   * @param {Function} steps[].check - Async status-check function:
   *   (context) => Promise<{complete: boolean, error?: boolean, failure?: Object, data?: Object}>.
   *   `failure` is opaque to the tracker and handed back untouched on error.
   *   `data` from a step that completes is accumulated into the final
   *   returned status so a caller can persist it (e.g. into session) and
   *   supply it back via `context` on a later call.
   */
  constructor (steps) {
    this.#steps = steps
  }

  /**
   * Determine current progress by checking uncompleted steps in order.
   *
   * Checks and advances at most one not-yet-completed step per call: when a
   * step's check reports complete, the *next* step is reported as the
   * current one (so its pending state renders) without being checked until
   * a later call. This guarantees every step gets at least one poll where
   * it is the one actually shown, even if the underlying work behind it
   * (and the one after it) finishes almost instantly - without needing any
   * artificial minimum-duration timer.
   *
   * @param {any} context - Passed directly to each step's check function
   * @param {Array<string>} [completedStepIds] - Step IDs already confirmed complete
   * @returns {Promise<{stepId: string, currentIndex: number, isComplete: boolean, isError: boolean, failure?: Object, completedStepIds: Array<string>, data: Object}>}
   */
  async getStatus (context, completedStepIds) {
    const completed = [...(completedStepIds ?? [])]
    const data = {}

    for (let index = 0; index < this.#steps.length; index++) {
      const step = this.#steps[index]

      if (completed.includes(step.id)) {
        continue
      }

      const result = await step.check(context)

      if (result.error) {
        return {
          stepId: step.id,
          currentIndex: index,
          isComplete: false,
          isError: true,
          failure: result.failure,
          completedStepIds: completed,
          data
        }
      }

      if (!result.complete) {
        return {
          stepId: step.id,
          currentIndex: index,
          isComplete: false,
          isError: false,
          completedStepIds: completed,
          data
        }
      }

      completed.push(step.id)

      if (result.data) {
        Object.assign(data, result.data)
      }

      const nextStep = this.#steps[index + 1]

      if (nextStep) {
        return {
          stepId: nextStep.id,
          currentIndex: index + 1,
          isComplete: false,
          isError: false,
          completedStepIds: completed,
          data
        }
      }

      return {
        stepId: step.id,
        currentIndex: index,
        isComplete: true,
        isError: false,
        completedStepIds: completed,
        data
      }
    }

    const lastIndex = this.#steps.length - 1

    return {
      stepId: this.#steps[lastIndex].id,
      currentIndex: lastIndex,
      isComplete: true,
      isError: false,
      completedStepIds: completed,
      data
    }
  }
}

export {
  ProgressTracker
}
