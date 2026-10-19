import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { AddressInfo } from 'node:net'
import { buildServer, createLimiter } from '../src/server.ts'
import { createEngine } from '../src/engine.ts'

async function withServer<T>(env: NodeJS.ProcessEnv, limit: number, fn: (base: string) => Promise<T>): Promise<T> {
  const engine = await createEngine(env)
  const server = buildServer(engine, createLimiter(limit, 60_000))
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  try {
    return await fn(`http://127.0.0.1:${(server.address() as AddressInfo).port}`)
  } finally {
    server.close()
  }
}
const post = (base: string, body: unknown) => fetch(`${base}/api/recommend`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

test('without keys the server runs in labelled sample mode', async () => {
  await withServer({} as NodeJS.ProcessEnv, 10, async (base) => {
    const health = (await (await fetch(`${base}/api/health`)).json()) as { mode: string; reason: string }
    assert.equal(health.mode, 'sample')
    assert.match(health.reason, /not set/)
    const res = await post(base, { request: 'a good movie to watch tonight', count: 2 })
    const body = (await res.json()) as { mode: string; recommendations: { qlooEntityId: string }[]; notes: string[] }
    assert.equal(res.status, 200)
    assert.equal(body.mode, 'sample')
    assert.ok(body.recommendations.length > 0)
    assert.ok(body.recommendations.every((r) => r.qlooEntityId.startsWith('sample:')), 'sample ids can never pass as Qloo ids')
    assert.match(body.notes[0]!, /Sample mode/)
  })
})

test('rejects bad input and applies the rate limit', async () => {
  await withServer({ TASTE_MODE: 'sample' } as NodeJS.ProcessEnv, 2, async (base) => {
    assert.equal((await post(base, { request: 'x' })).status, 400)
    assert.equal((await post(base, { request: 'a movie for tonight' })).status, 200)
    assert.equal((await post(base, { request: 'another movie' })).status, 429)
  })
})

test('serves the demo page and refuses path traversal', async () => {
  await withServer({ TASTE_MODE: 'sample' } as NodeJS.ProcessEnv, 10, async (base) => {
    const page = await fetch(base)
    assert.equal(page.status, 200)
    assert.match(await page.text(), /Taste Concierge/)
    assert.equal((await fetch(`${base}/..%2f..%2fpackage.json`)).status, 404)
  })
})

test('the limiter forgets old hits', () => {
  let t = 0
  const allow = createLimiter(1, 1000, () => t)
  assert.equal(allow('a'), true)
  assert.equal(allow('a'), false)
  t = 1500
  assert.equal(allow('a'), true)
  assert.equal(allow('b'), true)
})
