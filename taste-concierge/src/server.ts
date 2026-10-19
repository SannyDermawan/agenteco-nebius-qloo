import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createEngine, type Engine } from './engine.ts'
import { briefSchema } from './types.ts'

const PUBLIC_DIR = resolve(fileURLToPath(new URL('../public', import.meta.url)))
const TYPES: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.json': 'application/json' }

/** A small per-address limit so a public demo cannot burn the Qloo and Token Factory quotas. */
export function createLimiter(max: number, windowMs: number, now: () => number = Date.now) {
  const hits = new Map<string, number[]>()
  return (key: string): boolean => {
    const t = now()
    const recent = (hits.get(key) ?? []).filter((x) => t - x < windowMs)
    if (recent.length >= max) {
      hits.set(key, recent)
      return false
    }
    recent.push(t)
    hits.set(key, recent)
    return true
  }
}

function send(res: ServerResponse, status: number, body: unknown, type = 'application/json') {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' })
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body))
}

async function readBody(req: IncomingMessage, limit = 4_000): Promise<string> {
  let size = 0
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    size += (chunk as Buffer).length
    if (size > limit) throw new Error('Request too large')
    chunks.push(chunk as Buffer)
  }
  return Buffer.concat(chunks).toString('utf8')
}

export function buildServer(engine: Engine, allow = createLimiter(12, 60_000)) {
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost')
      if (req.method === 'GET' && url.pathname === '/api/health') return send(res, 200, { ok: true, mode: engine.mode, reason: engine.reason ?? null })
      if (req.method === 'POST' && url.pathname === '/api/recommend') {
        const who = String(req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? 'unknown').split(',')[0]!.trim()
        if (!allow(who)) return send(res, 429, { error: 'Too many requests, try again in a minute.' })
        let parsed: unknown
        try {
          parsed = JSON.parse(await readBody(req))
        } catch {
          return send(res, 400, { error: 'Send a JSON body like {"request": "..."}.' })
        }
        const brief = briefSchema.safeParse(parsed)
        if (!brief.success) return send(res, 400, { error: 'request must be 3 to 500 characters.' })
        return send(res, 200, await engine.run(brief.data))
      }
      if (req.method === 'GET') {
        const file = url.pathname === '/' ? 'index.html' : url.pathname.slice(1)
        const full = normalize(join(PUBLIC_DIR, file))
        if (!full.startsWith(PUBLIC_DIR)) return send(res, 404, { error: 'Not found' })
        try {
          return send(res, 200, await readFile(full), TYPES[extname(full)] ?? 'application/octet-stream')
        } catch {
          return send(res, 404, { error: 'Not found' })
        }
      }
      send(res, 404, { error: 'Not found' })
    } catch (error) {
      console.error('[server]', error)
      send(res, 500, { error: 'Something went wrong.' })
    }
  })
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const engine = await createEngine()
  const port = Number(process.env.PORT ?? 8787)
  buildServer(engine).listen(port, () => console.log(`Taste Concierge on http://localhost:${port} (${engine.mode} mode${engine.reason ? `: ${engine.reason}` : ''})`))
}
