import { test } from 'node:test'
import assert from 'node:assert/strict'
import { recommend, heuristicIntent } from '../src/agent.ts'
import type { QlooEntity, QlooLike } from '../src/qloo.ts'
import type { AiModel } from '@agenteco/sdk'

const entity = (id: string, name: string, affinity?: number): QlooEntity => ({ id, name, type: 'urn:entity:movie', tags: ['animation'], affinity })

function fakeQloo(opts: { search?: QlooEntity[]; insights?: QlooEntity[]; fail?: boolean } = {}): QlooLike & { calls: string[] } {
  const calls: string[] = []
  return {
    calls,
    async searchEntities(q) {
      calls.push(`search:${q}`)
      if (opts.fail) throw new Error('boom')
      return opts.search ?? []
    },
    async insights(o) {
      calls.push(`insights:${o.category}:${(o.seedEntityIds ?? []).join('+')}`)
      if (opts.fail) throw new Error('boom')
      return opts.insights ?? []
    },
  }
}

const intentJson = JSON.stringify({ categories: ['movie'], seeds: ['Spirited Away'], tags: ['fantasy'] })
const fast: AiModel = async () => intentJson
const reasoning = (picks: unknown[], summary = 'Because you like Studio Ghibli.'): AiModel => async () => JSON.stringify({ summary, picks })

test('recommends only entities that Qloo returned, with Qloo names and affinity', async () => {
  const qloo = fakeQloo({ search: [entity('seed-1', 'Spirited Away')], insights: [entity('a', 'Howl\'s Moving Castle', 0.91), entity('b', 'Kiki\'s Delivery Service', 0.8)] })
  const result = await recommend(
    { request: 'I loved Spirited Away' },
    { qloo, fast, reasoning: reasoning([{ qlooEntityId: 'a', why: 'Same studio and sense of wonder.', confidence: 0.4 }, { qlooEntityId: 'b', why: 'Gentle and magical.', confidence: 0.7 }]) }
  )
  assert.equal(result.mode, 'live')
  assert.deepEqual(result.recommendations.map((r) => r.qlooEntityId), ['a', 'b'])
  assert.equal(result.recommendations[0]!.name, "Howl's Moving Castle")
  assert.equal(result.recommendations[0]!.confidence, 0.91, "Qloo's affinity wins over the model's guess")
  assert.deepEqual(qloo.calls, ['search:Spirited Away', 'insights:movie:seed-1'])
  assert.equal(result.sources.length, 2)
})

test('drops a pick whose id Qloo never returned (no invented recommendations)', async () => {
  const qloo = fakeQloo({ search: [entity('seed-1', 'Spirited Away')], insights: [entity('a', 'Howl\'s Moving Castle', 0.9)] })
  const result = await recommend(
    { request: 'x movies' },
    { qloo, fast, reasoning: reasoning([{ qlooEntityId: 'made-up', why: 'Trust me.', confidence: 1 }, { qlooEntityId: 'a', why: 'Real.', confidence: 0.5 }]) }
  )
  assert.deepEqual(result.recommendations.map((r) => r.qlooEntityId), ['a'])
  assert.ok(result.notes.some((n) => n.includes('made-up')))
})

test('says so when Qloo returns nothing, instead of making something up', async () => {
  const result = await recommend({ request: 'something obscure' }, { qloo: fakeQloo(), fast, reasoning: reasoning([]) })
  assert.equal(result.recommendations.length, 0)
  assert.match(result.summary, /no data/i)
})

test('falls back to Qloo ranking when the reasoning model is unavailable, and says so', async () => {
  const qloo = fakeQloo({ search: [entity('seed-1', 'Spirited Away')], insights: [entity('a', 'A', 0.5), entity('b', 'B', 0.9)] })
  const broken: AiModel = async () => {
    throw new Error('503')
  }
  const result = await recommend({ request: 'movies like Spirited Away', count: 2 }, { qloo, fast, reasoning: broken })
  assert.deepEqual(result.recommendations.map((r) => r.qlooEntityId), ['b', 'a'])
  assert.ok(result.notes.some((n) => /unavailable/.test(n)))
})

test('guesses categories from keywords when the intent model fails', async () => {
  const qloo = fakeQloo({ insights: [entity('p1', 'Cafe')] })
  const broken: AiModel = async () => 'not json at all'
  const result = await recommend({ request: 'a quiet coffee place to read a book' }, { qloo, fast: broken, reasoning: reasoning([{ qlooEntityId: 'p1', why: 'Quiet.', confidence: 0.6 }]) })
  assert.ok(result.notes.some((n) => /guessed from keywords/.test(n)))
  assert.ok(qloo.calls.some((c) => c.startsWith('insights:place')))
  assert.deepEqual(heuristicIntent('podcast about space').categories, ['podcast'])
})

test('a Qloo failure is reported as a note, not a crash', async () => {
  const result = await recommend({ request: 'movies' }, { qloo: fakeQloo({ fail: true }), fast, reasoning: reasoning([]) })
  assert.equal(result.recommendations.length, 0)
  assert.ok(result.notes.some((n) => /failed/.test(n)))
})
