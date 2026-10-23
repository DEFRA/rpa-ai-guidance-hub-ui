import { defineConfig } from 'vite'
import { NodePackageImporter } from 'sass-embedded'

export default defineConfig({
  base: '/public',
  build: {
    outDir: '.public',
    manifest: true,
    rolldownOptions: {
      input: {
        htmlAssets: 'src/client/assets.html',
        application: 'src/client/javascripts/application.js',
        applicationCss: 'src/client/stylesheets/application.scss',
        defraLogo: 'src/client/images/defra-logo.svg',
        tiptap: 'src/client/javascripts/tiptap/viewer.js',
      },
      output: {
        advancedChunks: {
          groups: [
            { name: 'prosemirror', test: /node_modules[\\/](prosemirror-|@tiptap[\\/]pm)/ },
            { name: 'tiptap-vendor', test: /node_modules[\\/](@tiptap|marked|linkifyjs)/ }
          ]
        }
      }
    },
    sourcemap: true
  },
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler',
        importers: [new NodePackageImporter()],
        loadPaths: [
          'node_modules',
          'src/client/stylesheets',
          'src/server',
          'src/server/common/components',
          'src/server/common/templates/partials'
        ],
        quietDeps: true,
        sourceMapIncludeSources: true,
        style: 'expanded'
      }
    },
    lightningcss: { errorRecovery: true }
  },
  // Dev server
  server: {}
})
