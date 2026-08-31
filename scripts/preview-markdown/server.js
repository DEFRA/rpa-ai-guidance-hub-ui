#!/usr/bin/env node
/**
 * Serve one converted guidance document to a browser, loaded into TipTap.
 *
 * Analysis tooling, not part of the application: it exists to show what the docx
 * parser produced and what the guidance editor's schema would then do to it. The
 * only thing it borrows from this repository is the editor's dependencies, which
 * is why it lives here rather than in the orchestrator that launches it.
 *
 * A Vite dev server is used rather than the hapi application because none of the
 * application is wanted -- no session secret, no authentication, no Redis -- only
 * the ability to resolve `@tiptap/*` from this repository's node_modules and hand
 * the browser an ES module.
 *
 * Usage:
 *   node scripts/preview-markdown/server.js <document.md> [--port N] [--no-open]
 *
 * Normally reached through the orchestrator: `uv run task view <document.md>`.
 */

import fs from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { fileURLToPath } from 'node:url'

import { createServer } from 'vite'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(HERE, '..', '..')
const DEFAULT_PORT = 5173

// Kept out of the served directory, and inside a path this repository already
// ignores, so a preview never leaves anything behind in `scripts/`.
const CACHE_DIR = path.join(REPO_ROOT, '.cache', 'vite-preview-markdown')

const CONTENT_TYPES = {
  '.gif': 'image/gif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp'
}

/**
 * The directory the converter writes a document's images to.
 *
 * Mirrors `images_dir_name` in the orchestrator's `scripts/convert_doc.py`: the
 * name is derived from the document's own so that several documents converted
 * into one directory cannot overwrite each other's images. The two must agree,
 * or the pictures in the preview are broken.
 *
 * @param {string} document Absolute path to the Markdown file.
 * @returns {string} Absolute path to its images directory, which may not exist.
 */
function imagesDirFor (document) {
  const stem = path.basename(document, path.extname(document))

  return path.join(path.dirname(document), `${stem.replace(/\s+/g, '-')}-images`)
}

/**
 * Serve the document itself, plus its images, and reload the page when it changes.
 *
 * The document is read per request rather than at startup: re-running
 * `uv run task convert` in another terminal then shows up in the browser without
 * restarting anything.
 *
 * @param {string} document Absolute path to the Markdown file.
 * @returns {import('vite').Plugin}
 */
function documentPlugin (document) {
  const imagesDir = imagesDirFor(document)

  return {
    name: 'preview-markdown-document',
    configureServer (server) {
      server.middlewares.use('/document.json', (_request, response) => {
        response.setHeader('Content-Type', 'application/json; charset=utf-8')
        // The whole point is to re-read a file that changes underneath us.
        response.setHeader('Cache-Control', 'no-store')

        try {
          response.end(JSON.stringify({
            name: path.basename(document),
            path: document,
            markdown: fs.readFileSync(document, 'utf8')
          }))
        } catch (error) {
          response.statusCode = 404
          response.end(JSON.stringify({ error: error.message }))
        }
      })

      server.middlewares.use(
        `/${path.basename(imagesDir)}`,
        serveImages(imagesDir)
      )

      server.watcher.add(document)
      server.watcher.on('change', (changed) => {
        if (path.resolve(changed) === document) {
          // A full reload rather than an HMR update: the editor's whole state is
          // derived from the file, so there is nothing to preserve.
          const channel = server.hot ?? server.ws
          channel.send({ type: 'full-reload' })
        }
      })
    }
  }
}

/**
 * A minimal static handler for one directory.
 *
 * Vite serves files under its root; the images sit beside the document instead,
 * wherever that was converted to, so they need their own handler.
 *
 * @param {string} imagesDir
 * @returns {import('connect').NextHandleFunction}
 */
function serveImages (imagesDir) {
  return (request, response, next) => {
    const requested = decodeURIComponent((request.url ?? '/').split('?')[0])
    const file = path.join(imagesDir, requested)

    // Nothing here is authenticated, so a `..` in the path must not be able to
    // reach outside the images directory.
    if (path.relative(imagesDir, file).startsWith('..')) {
      response.statusCode = 403
      response.end()

      return
    }

    fs.readFile(file, (error, contents) => {
      if (error) {
        next()

        return
      }

      const type = CONTENT_TYPES[path.extname(file).toLowerCase()]
      response.setHeader('Content-Type', type ?? 'application/octet-stream')
      response.end(contents)
    })
  }
}

/**
 * Resolve the command line to a readable document and the server's options.
 *
 * @returns {{ document: string, port: number, open: boolean }}
 */
function readArguments () {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      port: { type: 'string' },
      // Named for the flag rather than negated, because parseArgs has no notion
      // of a `--no-` prefix.
      'no-open': { type: 'boolean', default: false }
    }
  })

  if (positionals.length !== 1) {
    throw new Error(
      'Expected exactly one Markdown document.\n' +
      'Usage: node scripts/preview-markdown/server.js <document.md> [--port N] [--no-open]'
    )
  }

  const document = path.resolve(positionals[0])

  // Nothing downstream would object: a .docx is a readable file, its zip bytes
  // decode to a string, and the Markdown parser accepts that string and renders
  // it as line noise. Only reachable when this script is run by hand -- the
  // orchestrator resolves a document to converted Markdown before calling it.
  if (path.extname(document).toLowerCase() !== '.md') {
    throw new Error(
      `Not a Markdown file: ${document}\n` +
      'This renders the Markdown a document was converted to. Run it through ' +
      '`uv run task view`, which finds that Markdown for you.'
    )
  }

  if (!fs.existsSync(document)) {
    throw new Error(`Document not found: ${document}`)
  }

  const port = values.port ? Number(values.port) : DEFAULT_PORT

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Not a port number: ${values.port}`)
  }

  return { document, port, open: !values['no-open'] }
}

async function main () {
  const { document, port, open } = readArguments()

  const server = await createServer({
    // This directory has no Vite config, but the repository root does, and it
    // describes the application's bundle rather than this page.
    configFile: false,
    root: HERE,
    cacheDir: CACHE_DIR,
    logLevel: 'info',
    plugins: [documentPlugin(document)],
    server: { port, open }
  })

  await server.listen()

  console.log(`\nPreviewing ${document}\n`)
  server.printUrls()
  console.log('\nPress Ctrl+C to stop.\n')
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
