// Makes three real calls to each service and prints what came back (never the keys). The output is what
// docs/API-NOTES.md records. Usage: npm run probe   with QLOO_API_KEY and NEBIUS_API_KEY in .env
import { createQloo } from '../src/qloo.ts'
import { resolveModels } from '../src/llm.ts'

const qlooKey = process.env.QLOO_API_KEY
const nebiusKey = process.env.NEBIUS_API_KEY
if (!qlooKey || !nebiusKey) throw new Error('Set QLOO_API_KEY and NEBIUS_API_KEY in .env first.')

const qloo = createQloo(process.env)
console.log('--- Qloo');
for (const q of ['Spirited Away', 'Radiohead', 'Blue Bottle Coffee']) {
  const hits = await qloo.searchEntities(q, { take: 2 })
  console.log(`search "${q}":`, hits.map((h) => `${h.name} [${h.type}] ${h.id}`).join(' | ') || 'no hits')
}
const seed = (await qloo.searchEntities('Spirited Away', { take: 1 }))[0]
if (seed) {
  const rec = await qloo.insights({ category: 'movie', seedEntityIds: [seed.id], take: 5 })
  console.log('insights for movies like Spirited Away:', rec.map((r) => `${r.name}${r.affinity !== undefined ? ` (${r.affinity.toFixed(2)})` : ''}`).join(', '))
}

console.log('--- Nebius Token Factory')
const models = await resolveModels()
console.log('fast model:', models.fast.id, '| reasoning model:', models.reasoning.id)
for (const [label, m] of [['fast', models.fast], ['reasoning', models.reasoning]] as const) {
  const started = Date.now()
  const text = await m.ai({ system: 'Reply with JSON only.', user: 'Return {"ok": true, "word": "hello"}' })
  console.log(`${label}: ${Date.now() - started} ms ->`, text.slice(0, 80))
}
