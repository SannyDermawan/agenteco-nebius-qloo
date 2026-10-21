import { execFile } from 'node:child_process'
import type { Category } from './types.ts'

/** A Qloo entity, reduced to the fields this agent uses. */
export interface QlooEntity {
  id: string
  name: string
  type: string
  description?: string
  tags: string[]
  /** Qloo's affinity of this entity with the signals sent (0 to 1) when the endpoint provides it. */
  affinity?: number
  popularity?: number
}

/** What the agent needs from Qloo. A fake can stand in for it in tests. */
export interface QlooLike {
  searchEntities(query: string, opts?: { take?: number }): Promise<QlooEntity[]>
  insights(opts: { category: Category; seedEntityIds?: string[]; take?: number }): Promise<QlooEntity[]>
}

export class QlooError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message)
    this.name = 'QlooError'
  }
}

export interface QlooOptions {
  apiKey: string
  /** Default https://hackathon.api.qloo.com, the only host the hackathon key works against (see docs/API-NOTES.md). */
  baseUrl?: string
  timeoutMs?: number
  retries?: number
  fetchImpl?: typeof fetch
}

/** Hackathon keys only work here; staging and production answer 401 (docs.qloo.com hackathon developer guide). */
const DEFAULT_BASE = 'https://hackathon.api.qloo.com'

/** Qloo's urn type for each category. */
export const QLOO_TYPE: Record<Category, string> = {
  movie: 'urn:entity:movie',
  tv_show: 'urn:entity:tv_show',
  artist: 'urn:entity:artist',
  place: 'urn:entity:place',
  book: 'urn:entity:book',
  brand: 'urn:entity:brand',
  podcast: 'urn:entity:podcast',
  videogame: 'urn:entity:video_game',
}

type Json = Record<string, unknown>
const asRecord = (v: unknown): Json => (v && typeof v === 'object' ? (v as Json) : {})
const asString = (v: unknown): string | undefined => (typeof v === 'string' && v.length > 0 ? v : undefined)
const asNumber = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)

/**
 * Turns one raw Qloo entity into a QlooEntity. The public docs leave the entity fields untyped, so this reads the
 * names Qloo uses (entity_id, name, types, properties.description, tags[].name, query.affinity) and ignores the rest.
 * An entity without an id or a name is dropped (null): the agent never recommends something it cannot cite.
 */
export function normalizeEntity(raw: unknown): QlooEntity | null {
  const e = asRecord(raw)
  const id = asString(e.entity_id) ?? asString(e.id)
  const name = asString(e.name)
  if (!id || !name) return null
  const types = Array.isArray(e.types) ? e.types.filter((t): t is string => typeof t === 'string') : []
  const properties = asRecord(e.properties)
  const tagsRaw = Array.isArray(e.tags) ? e.tags : []
  const tags = tagsRaw
    .map((t) => (typeof t === 'string' ? t : asString(asRecord(t).name)))
    .filter((t): t is string => Boolean(t))
    .slice(0, 8)
  const query = asRecord(e.query)
  const affinity = asNumber(query.affinity) ?? asNumber(e.affinity)
  return {
    id,
    name,
    // Insights entities carry a bare `type` of "urn:entity" (no kind), so only a full urn:entity:<kind> counts.
    type: [types[0], asString(e.type)].find((t) => t?.startsWith('urn:entity:')) ?? 'unknown',
    description: asString(properties.description) ?? asString(e.description),
    tags,
    affinity: affinity === undefined ? undefined : Math.max(0, Math.min(1, affinity)),
    popularity: asNumber(e.popularity),
  }
}

/**
 * Pulls the entity list out of the response shapes Qloo and the harness produce: `{ results: [...] }`,
 * `{ results: { entities: [...] } }` and the bare array that `qloo api ... --json` prints. Insights entities carry no
 * `types`, so the caller can pass the requested type as the fallback.
 */
export function extractEntities(body: unknown, fallbackType?: string): QlooEntity[] {
  const results = Array.isArray(body) ? body : asRecord(body).results
  const list = Array.isArray(results) ? results : Array.isArray(asRecord(results).entities) ? (asRecord(results).entities as unknown[]) : []
  return list
    .map(normalizeEntity)
    .filter((e): e is QlooEntity => e !== null)
    .map((e) => (e.type === 'unknown' && fallbackType ? { ...e, type: fallbackType } : e))
}

/** Runs one command and returns its stdout. A fake stands in for it in tests. */
export type RunCommand = (file: string, args: string[], env: NodeJS.ProcessEnv, timeoutMs: number) => Promise<string>

const runWithExecFile: RunCommand = (file, args, env, timeoutMs) =>
  new Promise((resolve, reject) => {
    // No shell: the arguments are passed as an array, so user text cannot become a command.
    execFile(file, args, { env, timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024, windowsHide: true }, (error, stdout) => {
      if (error) reject(error)
      else resolve(stdout)
    })
  })

export interface QlooHarnessOptions {
  /** The harness binary, default `qloo` on PATH (npm install -g @qloo/qloo-harness, version 0.1.26 or newer). */
  bin?: string
  timeoutMs?: number
  /** The event credential. It goes to the child process through the environment, never on the command line. */
  apiKey?: string
  /** Default https://hackathon.api.qloo.com. */
  baseUrl?: string
  run?: RunCommand
}

/**
 * Calls Qloo through the event's supported surface, `qloo api` from the public @qloo/qloo-harness package (the
 * kit's API_ACCESS.md lists it, with `qloo exec` and `qloo mcp`, as the only supported way). `qloo api ... --json`
 * prints the raw API response, so the same normalisation as the REST client applies.
 */
export class QlooHarnessClient implements QlooLike {
  private readonly bin: string
  private readonly run: RunCommand

  constructor(private readonly options: QlooHarnessOptions = {}) {
    this.bin = options.bin || 'qloo'
    this.run = options.run ?? runWithExecFile
  }

  async searchEntities(query: string, opts: { take?: number } = {}): Promise<QlooEntity[]> {
    return extractEntities(await this.call(['api', 'search', '--query', query, '--take', String(opts.take ?? 3), '--json']))
  }

  async insights(opts: { category: Category; seedEntityIds?: string[]; take?: number }): Promise<QlooEntity[]> {
    const args = ['api', 'insights', '--type', QLOO_TYPE[opts.category], '--take', String(Math.min(opts.take ?? 8, 50)), '--json']
    if (opts.seedEntityIds?.length) args.push('--signal-entities', opts.seedEntityIds.join(','))
    return extractEntities(await this.call(args), QLOO_TYPE[opts.category])
  }

  private async call(args: string[]): Promise<unknown> {
    const env: NodeJS.ProcessEnv = { ...process.env }
    if (this.options.apiKey) env.QLOO_API_KEY = this.options.apiKey
    // The harness refuses a custom endpoint unless it is also named as trusted.
    const base = (this.options.baseUrl || DEFAULT_BASE).replace(/\/+$/, '')
    env.QLOO_BASE_URL = base
    env.QLOO_TRUSTED_BASE_URL = base
    let out: string
    try {
      out = await this.run(this.bin, args, env, this.options.timeoutMs ?? 30_000)
    } catch (error) {
      const e = error as NodeJS.ErrnoException & { stderr?: string }
      if (e.code === 'ENOENT') throw new QlooError(`The Qloo harness (${this.bin}) is not installed. Run: npm install -g @qloo/qloo-harness`)
      throw new QlooError(`qloo ${args[1]} failed: ${(e.stderr || e.message || '').toString().split('\n')[0]}`)
    }
    try {
      return JSON.parse(out)
    } catch {
      throw new QlooError(`qloo ${args[1]} did not print JSON.`)
    }
  }
}

/** Direct REST client (`QLOO_TRANSPORT=rest`) or the harness (`QLOO_TRANSPORT=harness`). */
export function createQloo(env: NodeJS.ProcessEnv = process.env): QlooLike {
  if (env.QLOO_TRANSPORT === 'rest') return new QlooClient({ apiKey: env.QLOO_API_KEY ?? '', baseUrl: env.QLOO_BASE_URL })
  return new QlooHarnessClient({ bin: env.QLOO_BIN, apiKey: env.QLOO_API_KEY, baseUrl: env.QLOO_BASE_URL })
}

/** True when the harness binary answers `--version`. */
export type HarnessProbe = (bin: string) => Promise<boolean>
const probeHarness: HarnessProbe = (bin) =>
  new Promise((resolve) => execFile(bin, ['--version'], { timeout: 10_000, windowsHide: true }, (error) => resolve(!error)))

/**
 * What the server uses. `QLOO_TRANSPORT=harness|rest` is taken as given. Left unset, it picks the harness (the route
 * the event kit lists as supported) when it is installed, and the documented REST call to the hackathon host otherwise,
 * and says which in `transport`.
 */
export async function createQlooAuto(env: NodeJS.ProcessEnv = process.env, probe: HarnessProbe = probeHarness): Promise<{ client: QlooLike; transport: 'harness' | 'rest' }> {
  if (env.QLOO_TRANSPORT === 'rest') return { client: createQloo(env), transport: 'rest' }
  if (env.QLOO_TRANSPORT === 'harness') return { client: createQloo(env), transport: 'harness' }
  if (await probe(env.QLOO_BIN || 'qloo')) return { client: createQloo({ ...env, QLOO_TRANSPORT: 'harness' }), transport: 'harness' }
  return { client: createQloo({ ...env, QLOO_TRANSPORT: 'rest' }), transport: 'rest' }
}

export class QlooClient implements QlooLike {
  private readonly base: string
  private readonly doFetch: typeof fetch

  constructor(private readonly options: QlooOptions) {
    if (!options.apiKey) throw new QlooError('QLOO_API_KEY is not set.')
    this.base = (options.baseUrl || DEFAULT_BASE).replace(/\/+$/, '')
    this.doFetch = options.fetchImpl ?? fetch
  }

  async searchEntities(query: string, opts: { take?: number } = {}): Promise<QlooEntity[]> {
    const params = new URLSearchParams({ query, take: String(opts.take ?? 3) })
    return extractEntities(await this.get('/search', params))
  }

  async insights(opts: { category: Category; seedEntityIds?: string[]; take?: number }): Promise<QlooEntity[]> {
    const params = new URLSearchParams({ 'filter.type': QLOO_TYPE[opts.category], take: String(Math.min(opts.take ?? 8, 50)) })
    if (opts.seedEntityIds?.length) params.set('signal.interests.entities', opts.seedEntityIds.join(','))
    return extractEntities(await this.get('/v2/insights', params), QLOO_TYPE[opts.category])
  }

  private async get(path: string, params: URLSearchParams): Promise<unknown> {
    const url = `${this.base}${path}?${params.toString()}`
    const attempts = (this.options.retries ?? 2) + 1
    let last: QlooError | undefined
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        const res = await this.doFetch(url, {
          headers: { 'X-Api-Key': this.options.apiKey, Accept: 'application/json' },
          signal: AbortSignal.timeout(this.options.timeoutMs ?? 15_000),
        })
        if (res.ok) return await res.json()
        // 429 and 5xx are worth another try; other 4xx are our mistake and will not change.
        last = new QlooError(`Qloo answered HTTP ${res.status} for ${path}`, res.status)
        if (res.status !== 429 && res.status < 500) throw last
      } catch (error) {
        if (error instanceof QlooError && error.status && error.status !== 429 && error.status < 500) throw error
        last = error instanceof QlooError ? error : new QlooError(`Qloo request failed: ${(error as Error).message}`)
      }
      if (attempt < attempts) await new Promise((r) => setTimeout(r, 400 * attempt))
    }
    throw last ?? new QlooError('Qloo request failed.')
  }
}
