// Minimal static server for the production build (used by Railway: `npm start`). No dependencies.
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const root = join(fileURLToPath(new URL('.', import.meta.url)), 'dist')
const port = Number(process.env.PORT) || 5181

const gzCache = new Map()
const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.json', '.svg', '.wasm'])

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
}

createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname)
    let file = normalize(join(root, path))
    if (!file.startsWith(root)) {
      res.writeHead(403).end()
      return
    }
    if (!(await stat(file).catch(() => null))?.isFile()) file = join(root, 'index.html')
    let body = await readFile(file)
    const hashed = file.includes(`${join('dist', 'assets')}`)
    const headers = {
      'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
      'Cache-Control': hashed ? 'public, max-age=31536000, immutable' : 'no-cache',
      Vary: 'Accept-Encoding',
    }
    if (COMPRESSIBLE.has(extname(file)) && /gzip/.test(req.headers['accept-encoding'] ?? '')) {
      if (!gzCache.has(file)) gzCache.set(file, gzipSync(body, { level: 9 }))
      body = gzCache.get(file)
      headers['Content-Encoding'] = 'gzip'
    }
    res.writeHead(200, headers)
    res.end(body)
  } catch {
    res.writeHead(500).end('Server error')
  }
}).listen(port, '0.0.0.0', () => console.log(`Rift Runners serving ${root} on :${port}`))
