// A line-level diff, so the losses pane can show what normalising a document
// through TipTap changed, rather than leaving two walls of text to be compared
// by eye.
//
// Hand-rolled rather than pulled from npm: the only dependencies this repository
// takes on for the preview are the ones the guidance editor itself will need.

/**
 * Length of the longest common subsequence of every prefix pair.
 *
 * One flat Int32Array rather than nested arrays: guidance documents run to a few
 * thousand lines, and the table is the only part of this that is not trivially
 * small.
 *
 * @param {string[]} before
 * @param {string[]} after
 * @returns {{ table: Int32Array, width: number }}
 */
function lcsTable (before, after) {
  const width = after.length + 1
  const table = new Int32Array((before.length + 1) * width)

  for (let i = before.length - 1; i >= 0; i--) {
    for (let j = after.length - 1; j >= 0; j--) {
      table[i * width + j] = before[i] === after[j]
        ? table[(i + 1) * width + j + 1] + 1
        : Math.max(table[(i + 1) * width + j], table[i * width + j + 1])
    }
  }

  return { table, width }
}

/**
 * Diff two Markdown documents line by line.
 *
 * @param {string} before
 * @param {string} after
 * @returns {Array<{ type: 'same'|'removed'|'added', text: string }>} One entry per
 *   line, in reading order, with removals placed before the additions at the same
 *   point so a changed line reads as a pair.
 */
function diffLines (before, after) {
  const left = before.split('\n')
  const right = after.split('\n')
  const { table, width } = lcsTable(left, right)

  const lines = []
  let i = 0
  let j = 0

  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) {
      lines.push({ type: 'same', text: left[i] })
      i++
      j++
    } else if (table[(i + 1) * width + j] >= table[i * width + j + 1]) {
      lines.push({ type: 'removed', text: left[i] })
      i++
    } else {
      lines.push({ type: 'added', text: right[j] })
      j++
    }
  }

  for (; i < left.length; i++) {
    lines.push({ type: 'removed', text: left[i] })
  }

  for (; j < right.length; j++) {
    lines.push({ type: 'added', text: right[j] })
  }

  return lines
}

/**
 * Count the words in a document, the way the docx audit does: runs of
 * non-whitespace. Crude, but comparable between the two sides, which is all the
 * headline needs.
 *
 * @param {string} text
 * @returns {number}
 */
function countWords (text) {
  const words = text.match(/\S+/g)

  return words ? words.length : 0
}

export { countWords, diffLines }
