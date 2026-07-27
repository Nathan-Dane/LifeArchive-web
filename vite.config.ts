/// <reference types="vitest/config" />
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const runtimeDirectory = path.resolve(import.meta.dirname, 'runtime/installed')
const runtimeMimeTypes: Readonly<Record<string, string>> = {
  '.d.ts': 'text/plain; charset=utf-8',
  '.gz': 'application/gzip',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
}

function localRuntimeFiles() {
  return {
    name: 'lifearchive-local-runtime-files',
    apply: 'serve' as const,
    configureServer(server: {
      middlewares: {
        use(
          route: string,
          handler: (
            request: { readonly url?: string },
            response: {
              statusCode: number
              setHeader(name: string, value: string): void
              end(body?: Uint8Array): void
            },
            next: () => void,
          ) => void,
        ): void
      }
    }) {
      server.middlewares.use(
        '/runtime/installed/',
        (request, response, next) => {
          const name = decodeURIComponent(
            (request.url ?? '').split('?')[0],
          ).replace(/^\/+/, '')
          if (!name || name.includes('/') || name.includes('\\')) {
            next()
            return
          }
          const extension = name.endsWith('.d.ts')
            ? '.d.ts'
            : path.extname(name)
          void readFile(path.join(runtimeDirectory, name))
            .then((bytes) => {
              response.statusCode = 200
              response.setHeader(
                'Content-Type',
                runtimeMimeTypes[extension] ?? 'application/octet-stream',
              )
              response.setHeader('Cache-Control', 'no-store')
              response.setHeader('Cross-Origin-Resource-Policy', 'same-origin')
              response.end(bytes)
            })
            .catch(() => next())
        },
      )
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [localRuntimeFiles(), react()],
  base: '/',
  server: {
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },
  preview: {
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    /*
     * Vitest returns an empty string for a stylesheet unless CSS processing is
     * on. The token and layout tests read the real stylesheets, so it is on.
     */
    css: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
