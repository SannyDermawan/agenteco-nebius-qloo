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
  /** Default https://api.qloo.com (see docs/API-NOTES.md). */
  baseUrl?: string
  timeoutMs?: number
  retries?: number
  fetchImpl?: typeof fetch
}

const DEFAULT_BASE = 'https://api.qloo.com'

/** Qloo's urn type for each category. */
export const QLOO_TYPE: Record<Category, string> = {
  movie: 'urn:entity:movie',
  tv_show: 'urn:entity:tv_show',
  artist: 'urn:entity:artist',
  place: 'urn:entity:place',
  book: 'urn:entity:book',
  brand: 'urn:entity:brand',
  podcast: 'urn:entity:podcast',
  videogame: 'urn:entity:videogame',
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
    type: types[0] ?? asString(e.type) ?? 'unknown',
    description: asString(properties.description) ?? asString(e.description),
    tags,
    affinity: affinity === undefined ? undefined : Math.max(0, Math.min(1, affinity)),
    popularity: asNumber(e.popularity),
  }
}

/** Pulls the entity list out of the two response shapes Qloo uses (`results` array, or `results.entities`). */
export function extractEntities(body: unknown): QlooEntity[] {
  const results = asRecord(body).results
  const list = Array.isArray(results) ? results : Array.isArray(asRecord(results).entities) ? (asRecord(results).entities as unknown[]) : []
  return list.map(normalizeEntity).filter((e): e is QlooEntity => e !== null)
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
    return extractEntities(await this.get('/v2/insights', params))
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
