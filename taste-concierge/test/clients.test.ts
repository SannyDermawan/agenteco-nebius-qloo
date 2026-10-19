import { test } from 'node:test'
import assert from 'node:assert/strict'
import { QlooClient, QlooError, extractEntities, normalizeEntity } from '../src/qloo.ts'
import { pickNemotronModels, resolveModels } from '../src/llm.ts'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

test('normalizeEntity reads Qloo fields and drops entities it cannot cite', () => {
  const e = normalizeEntity({ entity_id: 'ABC', name: 'Spirited Away', types: ['urn:entity:movie'], properties: { description: 'A girl enters a spirit world.' }, tags: [{ name: 'animation' }, 'fantasy'], query: { affinity: 1.4 }, popularity: 0.9 })
  assert.deepEqual(e, { id: 'ABC', name: 'Spirited Away', type: 'urn:entity:movie', description: 'A girl enters a spirit world.', tags: ['animation', 'fantasy'], affinity: 1, popularity: 0.9 })
  assert.equal(normalizeEntity({ name: 'No id' }), null)
  assert.equal(normalizeEntity('nope'), null)
})

test('extractEntities handles both response shapes', () => {
  assert.equal(extractEntities({ results: [{ entity_id: '1', name: 'A' }] }).length, 1)
  assert.equal(extractEntities({ results: { entities: [{ entity_id: '1', name: 'A' }, { name: 'bad' }] } }).length, 1)
  assert.equal(extractEntities({}).length, 0)
})

test('QlooClient sends the key header and documented parameters', async () => {
  const seen: { url: string; key: string | null }[] = []
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    seen.push({ url: String(url), key: new Headers(init?.headers).get('x-api-key') })
    return json({ results: { entities: [{ entity_id: 'm1', name: 'Movie' }] } })
  }) as unknown as typeof fetch
  const client = new QlooClient({ apiKey: 'test-key', baseUrl: 'https://qloo.example/', fetchImpl })
  const out = await client.insights({ category: 'movie', seedEntityIds: ['s1', 's2'], take: 99 })
  assert.equal(out[0]!.id, 'm1')
  const url = new URL(seen[0]!.url)
  assert.equal(url.origin + url.pathname, 'https://qloo.example/v2/insights')
  assert.equal(url.searchParams.get('filter.type'), 'urn:entity:movie')
  assert.equal(url.searchParams.get('signal.interests.entities'), 's1,s2')
  assert.equal(url.searchParams.get('take'), '50', 'take is capped at the documented maximum')
  assert.equal(seen[0]!.key, 'test-key')
  await client.searchEntities('Spirited Away', { take: 2 })
  assert.equal(new URL(seen[1]!.url).pathname, '/search')
})

test('QlooClient retries 429 and 5xx but not other 4xx', async () => {
  let calls = 0
  const flaky = (async () => (++calls < 3 ? json({}, calls === 1 ? 429 : 503) : json({ results: [] }))) as unknown as typeof fetch
  assert.deepEqual(await new QlooClient({ apiKey: 'k', fetchImpl: flaky, retries: 2 }).searchEntities('x'), [])
  assert.equal(calls, 3)
  let bad = 0
  const forbidden = (async () => (bad++, json({}, 401))) as unknown as typeof fetch
  await assert.rejects(new QlooClient({ apiKey: 'k', fetchImpl: forbidden, retries: 2 }).searchEntities('x'), (e: unknown) => e instanceof QlooError && e.status === 401)
  assert.equal(bad, 1)
  assert.throws(() => new QlooClient({ apiKey: '' }), /QLOO_API_KEY/)
})

test('pickNemotronModels prefers Ultra for reasoning and Nano for speed', () => {
  const ids = ['meta/llama', 'nvidia/Nemotron-3-Nano-30b', 'nvidia/Nemotron-3-Super-120b', 'nvidia/Nemotron-3-Ultra-550b']
  assert.deepEqual(pickNemotronModels(ids), { reasoning: 'nvidia/Nemotron-3-Ultra-550b', fast: 'nvidia/Nemotron-3-Nano-30b' })
  assert.deepEqual(pickNemotronModels(['nvidia/Nemotron-3-Super-120b']), { reasoning: 'nvidia/Nemotron-3-Super-120b', fast: 'nvidia/Nemotron-3-Super-120b' })
  assert.equal(pickNemotronModels(['meta/llama']), null)
})

test('resolveModels uses the live model list when ids are not configured, and the configured ids when they are', async () => {
  const listing = (async () => json({ data: [{ id: 'nvidia/Nemotron-3-Nano-30b' }, { id: 'nvidia/Nemotron-3-Ultra-550b' }] })) as unknown as typeof fetch
  const picked = await resolveModels({ NEBIUS_API_KEY: 'k' } as NodeJS.ProcessEnv, listing)
  assert.equal(picked.reasoning.id, 'nvidia/Nemotron-3-Ultra-550b')
  const configured = await resolveModels({ NEBIUS_API_KEY: 'k', NEBIUS_MODEL_FAST: 'a/b', NEBIUS_MODEL_REASONING: 'c/d' } as NodeJS.ProcessEnv, (async () => assert.fail('must not list')) as unknown as typeof fetch)
  assert.deepEqual([configured.fast.id, configured.reasoning.id], ['a/b', 'c/d'])
  await assert.rejects(resolveModels({} as NodeJS.ProcessEnv), /NEBIUS_API_KEY/)
})
