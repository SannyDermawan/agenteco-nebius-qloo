import { askJson, type AiModel } from '@agenteco/sdk'
import type { QlooEntity, QlooLike } from './qloo.ts'
import { CATEGORIES, intentSchema, selectionSchema, type Brief, type Category, type Intent, type Recommendation, type Source, type TasteResult } from './types.ts'

export interface AgentDeps {
  qloo: QlooLike
  /** Quick extraction of intent from the request (a small Nemotron). */
  fast: AiModel
  /** Final selection and explanation (the largest Nemotron available). */
  reasoning: AiModel
  models?: { fast: string; reasoning: string }
  log?: (message: string) => void
}

const CANDIDATES_PER_CATEGORY = 8

const KEYWORDS: [Category, RegExp][] = [
  ['movie', /\b(movie|film|cinema)s?\b/i],
  ['tv_show', /\b(tv|series|show|anime|netflix)s?\b/i],
  ['artist', /\b(music|song|band|artist|album|playlist)s?\b/i],
  ['place', /\b(restaurant|cafe|coffee|bar|place|food|eat|hotel|travel|trip|visit)s?\b/i],
  ['book', /\b(book|novel|read)s?\b/i],
  ['podcast', /\bpodcasts?\b/i],
  ['videogame', /\b(game|games|gaming)\b/i],
  ['brand', /\b(brand|fashion|shoes|sneakers|clothes)s?\b/i],
]

/** Used when the model cannot extract an intent: guess categories from keywords so the request still works. */
export function heuristicIntent(request: string): Intent {
  const categories = KEYWORDS.filter(([, re]) => re.test(request)).map(([c]) => c)
  return { categories: categories.length ? categories.slice(0, 3) : ['movie'], seeds: [], tags: [] }
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))

function intentPrompt(request: string) {
  return {
    system:
      'You extract structured intent from a request for taste-based recommendations. ' +
      `Answer with JSON: {"categories": [...], "seeds": [...], "tags": [...]}. ` +
      `"categories" uses only these values: ${CATEGORIES.join(', ')} (1 to 3 of them). ` +
      '"seeds" are titles, artists or places the person says they already like (names only, at most 5). ' +
      '"tags" are short moods or genres they ask for (at most 5). Do not invent seeds that the request does not mention.',
    user: `<DATA>\n${request}\n</DATA>`,
  }
}

function selectionPrompt(request: string, seeds: QlooEntity[], candidates: QlooEntity[], count: number, tags: string[]) {
  const list = candidates
    .map((c) => JSON.stringify({ id: c.id, name: c.name, type: c.type, tags: c.tags.slice(0, 5), description: c.description?.slice(0, 160), affinity: c.affinity }))
    .join('\n')
  return {
    system:
      'You are a taste concierge. Choose the best recommendations for the request ONLY from the candidate list, which came from ' +
      "Qloo's taste graph. Never mention or recommend anything that is not in the list. " +
      `Return JSON: {"summary": string (one or two sentences), "picks": [{"qlooEntityId": string, "why": string (one sentence tied to the request), "confidence": number 0 to 1}]} ` +
      `with at most ${count} picks, best first. Use each candidate's id exactly as given.`,
    user: `Request:\n<DATA>\n${request}\n</DATA>\n\nThings the person likes (resolved by Qloo):\n<DATA>\n${seeds.map((s) => `${s.name} (${s.id})`).join('\n') || 'none given'}\n</DATA>\n\nMoods or genres asked for:\n<DATA>\n${tags.join(', ') || 'none'}\n</DATA>\n\nCandidates from Qloo, one JSON object per line:\n<DATA>\n${list}\n</DATA>`,
  }
}

/**
 * The agent: understand the request (Nemotron, small), ask Qloo what people with that taste like, let Nemotron (large)
 * choose and explain, then CHECK the answer against what Qloo returned. A pick whose id Qloo never returned is dropped,
 * so the agent cannot recommend something it made up. If nothing comes back it says so.
 */
export async function recommend(brief: Brief, deps: AgentDeps): Promise<TasteResult> {
  const { qloo, log } = deps
  const count = brief.count ?? 5
  const notes: string[] = []
  const sources: Source[] = []

  // 1. Intent.
  let intent = await askJson(deps.fast, intentPrompt(brief.request), intentSchema, log)
  if (!intent) {
    notes.push('The language model could not read the request, so categories were guessed from keywords.')
    intent = heuristicIntent(brief.request)
  }

  // 2. Resolve what the person already likes to Qloo entities.
  const seeds: QlooEntity[] = []
  for (const name of intent.seeds) {
    try {
      const hit = (await qloo.searchEntities(name, { take: 1 }))[0]
      if (hit) {
        seeds.push(hit)
        sources.push({ kind: 'qloo-search', detail: `"${name}" -> ${hit.name}`, entityIds: [hit.id] })
      } else {
        notes.push(`Qloo found no entity for "${name}".`)
      }
    } catch (error) {
      notes.push(`Qloo search for "${name}" failed: ${(error as Error).message}`)
    }
  }

  // 3. Candidates from Qloo's insights, per category.
  const candidates = new Map<string, QlooEntity>()
  for (const category of intent.categories) {
    try {
      const found = await qloo.insights({
        category,
        seedEntityIds: seeds.map((s) => s.id),
        take: CANDIDATES_PER_CATEGORY,
      })
      for (const e of found) if (!seeds.some((s) => s.id === e.id)) candidates.set(e.id, e)
      sources.push({ kind: 'qloo-insights', detail: `${category}${seeds.length ? ` for ${seeds.length} seed(s)` : ' (no seeds)'}`, entityIds: found.map((e) => e.id) })
    } catch (error) {
      notes.push(`Qloo insights for ${category} failed: ${(error as Error).message}`)
    }
  }

  const pool = [...candidates.values()]
  if (pool.length === 0) {
    return { summary: 'Qloo returned no data for this request, so there is nothing to recommend.', recommendations: [], sources, mode: 'live', notes, models: deps.models }
  }

  // 4. Selection with the large model, then verification against Qloo's list.
  const selection = await askJson(deps.reasoning, selectionPrompt(brief.request, seeds, pool, count, intent.tags), selectionSchema, log)
  const byId = new Map(pool.map((e) => [e.id, e]))
  const recommendations: Recommendation[] = []
  let summary = ''
  if (selection) {
    summary = selection.summary
    for (const pick of selection.picks) {
      const entity = byId.get(pick.qlooEntityId)
      if (!entity) {
        notes.push(`Dropped a pick whose id (${pick.qlooEntityId}) Qloo did not return.`)
        continue
      }
      if (recommendations.some((r) => r.qlooEntityId === entity.id)) continue
      // Name and category are Qloo's, not the model's; the model supplies the reasoning only.
      recommendations.push({ name: entity.name, category: entity.type, why: pick.why, qlooEntityId: entity.id, confidence: clamp01(entity.affinity ?? pick.confidence) })
    }
  } else {
    notes.push('The reasoning model was unavailable, so the list is ranked by Qloo affinity alone.')
  }

  if (recommendations.length === 0 && pool.length > 0) {
    const ranked = pool.slice().sort((a, b) => (b.affinity ?? 0) - (a.affinity ?? 0)).slice(0, count)
    for (const e of ranked) {
      recommendations.push({ name: e.name, category: e.type, why: `Qloo ranks it among the closest matches${e.tags.length ? ` (${e.tags.slice(0, 3).join(', ')})` : ''}.`, qlooEntityId: e.id, confidence: clamp01(e.affinity ?? 0.5) })
    }
    summary ||= 'Closest matches from Qloo.'
  }

  return { summary, recommendations: recommendations.slice(0, count), sources, mode: 'live', notes, models: deps.models }
}
