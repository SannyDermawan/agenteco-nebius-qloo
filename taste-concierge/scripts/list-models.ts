// Lists the models your Token Factory key can use and shows which Nemotron ids the agent would pick.
// Usage: NEBIUS_API_KEY=... npm run models   (the key is read from the environment and never printed)
import { listModelIds, pickNemotronModels } from '../src/llm.ts'

const key = process.env.NEBIUS_API_KEY
if (!key) throw new Error('Set NEBIUS_API_KEY in .env first.')
const ids = await listModelIds(key, process.env.NEBIUS_BASE_URL || undefined)
const nemotron = ids.filter((id) => /nemotron/i.test(id))
console.log(`${ids.length} models listed, ${nemotron.length} Nemotron:`)
for (const id of nemotron) console.log(`  ${id}`)
console.log('The agent would use:', pickNemotronModels(ids) ?? 'no Nemotron model found')
