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
   * @param {string} steps[].label - User-facing step label
   * @param {Function} steps[].check - Async status-check function: (context) => Promise<{complete: boolean, error?: boolean}>
   */
  constructor (steps) {
    this.#steps = steps
  }

  /**
   * Determine current progress by checking uncompleted steps in order.
   *
   * @param {any} context - Passed directly to each step's check function
   * @param {Array<string>} [completedStepIds] - Step IDs already confirmed complete
   * @returns {Promise<{stepId: string, currentIndex: number, isComplete: boolean, isError: boolean, completedStepIds: Array<string>}>}
   */
  async getStatus (context, completedStepIds) {
    const completed = [...(completedStepIds ?? [])]

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
          completedStepIds: completed
        }
      }

      if (!result.complete) {
        return {
          stepId: step.id,
          currentIndex: index,
          isComplete: false,
          isError: false,
          completedStepIds: completed
        }
      }

      completed.push(step.id)
    }

    const lastIndex = this.#steps.length - 1

    return {
      stepId: this.#steps[lastIndex].id,
      currentIndex: lastIndex,
      isComplete: true,
      isError: false,
      completedStepIds: completed
    }
  }
}

export {
  ProgressTracker
}
