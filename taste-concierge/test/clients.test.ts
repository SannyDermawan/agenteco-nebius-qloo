import { test } from 'node:test'
import assert from 'node:assert/strict'
import { QlooClient, QlooHarnessClient, QlooError, createQloo, createQlooAuto, extractEntities, normalizeEntity } from '../src/qloo.ts'
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

test('QlooHarnessClient calls `qloo api` with an argument array and keeps the key off the command line', async () => {
  const calls: { file: string; args: string[]; keyInEnv: string | undefined }[] = []
  const run = async (file: string, args: string[], env: NodeJS.ProcessEnv) => {
    calls.push({ file, args, keyInEnv: env.QLOO_API_KEY })
    return JSON.stringify({ results: [{ entity_id: 'm1', name: 'Movie' }] })
  }
  const client = new QlooHarnessClient({ apiKey: 'event-key', run })
  const found = await client.searchEntities('Spirited Away"; rm -rf /', { take: 2 })
  assert.equal(found[0]!.id, 'm1')
  assert.deepEqual(calls[0]!.args, ['api', 'search', '--query', 'Spirited Away"; rm -rf /', '--take', '2', '--json'], 'user text is one argument, never a shell string')
  await client.insights({ category: 'movie', seedEntityIds: ['s1', 's2'], take: 99 })
  assert.deepEqual(calls[1]!.args, ['api', 'insights', '--type', 'urn:entity:movie', '--take', '50', '--json', '--signal-entities', 's1,s2'])
  assert.equal(calls[1]!.keyInEnv, 'event-key')
  assert.ok(calls.every((c) => !c.args.includes('--api-key') && !c.args.includes('event-key')), 'the key is never an argument')
})

test('QlooHarnessClient explains a missing harness and bad output', async () => {
  const missing = new QlooHarnessClient({ run: async () => { throw Object.assign(new Error('spawn qloo ENOENT'), { code: 'ENOENT' }) } })
  await assert.rejects(missing.searchEntities('x'), (e: unknown) => e instanceof QlooError && /npm install -g @qloo\/qloo-harness/.test(e.message))
  const garbage = new QlooHarnessClient({ run: async () => 'not json' })
  await assert.rejects(garbage.searchEntities('x'), /did not print JSON/)
  const failing = new QlooHarnessClient({ run: async () => { throw Object.assign(new Error('exit 1'), { stderr: 'error: 401 unauthorized\nmore' }) } })
  await assert.rejects(failing.insights({ category: 'movie' }), /401 unauthorized/)
})

test('createQloo picks the harness by default and REST only when asked', () => {
  assert.ok(createQloo({ QLOO_API_KEY: 'k' }) instanceof QlooHarnessClient)
  assert.ok(createQloo({ QLOO_API_KEY: 'k', QLOO_TRANSPORT: 'rest' }) instanceof QlooClient)
})

test('extractEntities reads the bare array the harness prints and fills in the requested type for insights', () => {
  const bare = [{ entity_id: 'a', name: 'Howl', query: { affinity: 0.97 } }, { name: 'no id' }]
  const out = extractEntities(bare, 'urn:entity:movie')
  assert.equal(out.length, 1)
  assert.equal(out[0]!.type, 'urn:entity:movie')
  assert.equal(extractEntities([{ entity_id: 'a', name: 'X', types: ['urn:entity:book'] }], 'urn:entity:movie')[0]!.type, 'urn:entity:book', 'a type Qloo gave is kept')
})

test('the default host is the hackathon host and the harness is told to trust exactly that endpoint', async () => {
  const seen: { url: string }[] = []
  const fetchImpl = (async (url: string) => { seen.push({ url: String(url) }); return json({ results: [] }) }) as unknown as typeof fetch
  await new QlooClient({ apiKey: 'k', fetchImpl }).searchEntities('x')
  assert.equal(new URL(seen[0]!.url).origin, 'https://hackathon.api.qloo.com')
  let childEnv: NodeJS.ProcessEnv = {}
  await new QlooHarnessClient({ apiKey: 'k', run: async (_f, _a, env) => { childEnv = env; return '[]' } }).searchEntities('x')
  assert.equal(childEnv.QLOO_BASE_URL, 'https://hackathon.api.qloo.com')
  assert.equal(childEnv.QLOO_TRUSTED_BASE_URL, 'https://hackathon.api.qloo.com')
})

test('createQlooAuto uses the harness when installed and REST otherwise, and obeys an explicit choice', async () => {
  const yes = async () => true
  const no = async () => false
  assert.equal((await createQlooAuto({ QLOO_API_KEY: 'k' }, yes)).transport, 'harness')
  assert.equal((await createQlooAuto({ QLOO_API_KEY: 'k' }, no)).transport, 'rest')
  assert.equal((await createQlooAuto({ QLOO_API_KEY: 'k', QLOO_TRANSPORT: 'rest' }, yes)).transport, 'rest')
  assert.equal((await createQlooAuto({ QLOO_API_KEY: 'k', QLOO_TRANSPORT: 'harness' }, no)).transport, 'harness')
})

test('an insights entity with a bare urn:entity type gets the requested kind', () => {
  const out = extractEntities({ results: [{ entity_id: 'a', name: 'Howl', type: 'urn:entity' }] }, 'urn:entity:movie')
  assert.equal(out[0]!.type, 'urn:entity:movie')
})

test('parseWalletKey accepts an EVM key, a base58 Solana key and a JSON array, and refuses anything else', async () => {
  const { parseWalletKey, base58Decode } = await import('../src/wallet-key.ts')
  const evm = '0x' + 'ab'.repeat(32)
  assert.equal(parseWalletKey(evm), evm)
  const bytes = Uint8Array.from({ length: 64 }, (_, i) => (i * 7 + 3) % 256)
  const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
  let n = BigInt('0x' + Buffer.from(bytes).toString('hex'))
  let b58 = ''
  while (n > 0n) { b58 = ALPHABET[Number(n % 58n)] + b58; n /= 58n }
  assert.deepEqual(parseWalletKey(b58), bytes)
  assert.deepEqual(parseWalletKey(JSON.stringify(Array.from(bytes))), bytes)
  assert.deepEqual(base58Decode('11' + b58.slice(0, 5)).slice(0, 2), Uint8Array.from([0, 0]), 'leading 1s are zero bytes')
  assert.throws(() => parseWalletKey(undefined), /Missing WALLET_PRIVATE_KEY/)
  assert.throws(() => parseWalletKey('0x1234'), /32 bytes of hex/)
  assert.throws(() => parseWalletKey('abc'), /must be an EVM key/)
  assert.throws(() => parseWalletKey('not*base58'), /not valid base58/)
})

test('configureChainsFromApi sets the Solana program and mint from /chains, keeps values already set, ignores EVM chains', async () => {
  const { configureChainsFromApi } = await import('../src/chains.ts')
  const body = [
    { chainId: 'eip155:97', family: 'evm', agentEco: '0xabc', token: { address: '0xdef' } },
    { chainId: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1', family: 'solana', agentEco: 'ProgramAddr', token: { address: 'MintAddr' } },
  ]
  const fetchImpl = (async () => new Response(JSON.stringify(body))) as unknown as typeof fetch
  const env: NodeJS.ProcessEnv = { TOKEN_MINT__solana_EtWTRABZaYq6iMfeYKouRu166VU2xqa1: 'MyMint' }
  const done = await configureChainsFromApi('https://api.example/', env, fetchImpl)
  assert.deepEqual(done, ['solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1'])
  assert.equal(env.AGENT_ECO_PROGRAM__solana_EtWTRABZaYq6iMfeYKouRu166VU2xqa1, 'ProgramAddr')
  assert.equal(env.TOKEN_MINT__solana_EtWTRABZaYq6iMfeYKouRu166VU2xqa1, 'MyMint', 'a value already set wins')
  assert.equal(Object.keys(env).some((k) => k.includes('eip155')), false)
})
