import { createSellerAgent, registerCapability, resolveCapability } from '@agenteco/sdk'
import { createEngine } from './engine.ts'
import { configureChainsFromApi, requireApiUrl } from './chains.ts'
import { parseWalletKey } from './wallet-key.ts'
import { briefSchema, CAPABILITY_ID } from './types.ts'

/**
 * Sells "taste_recommendations" on AgentEco: a buyer escrows a small amount, this agent answers from Qloo's taste graph with
 * Nemotron on Nebius, and the buyer accepts or disputes. Run it with a testnet wallet:
 *
 *   WALLET_PRIVATE_KEY=<Solana secret key (base58) or 0x... EVM key> npm run seller
 *
 * It publishes the capability to the open registry only if nobody has. Registering is a write to the shared API, so this
 * script is something the maintainer runs on purpose; it is never run by the tests or the demo server.
 */
const privateKey = parseWalletKey(process.env.WALLET_PRIVATE_KEY)
const apiUrl = requireApiUrl()

await configureChainsFromApi(apiUrl)
const engine = await createEngine()
if (engine.mode !== 'live') {
  throw new Error(`The seller only sells live answers. ${engine.reason ?? ''} Set QLOO_API_KEY and NEBIUS_API_KEY.`)
}

try {
  await resolveCapability(apiUrl, CAPABILITY_ID)
} catch {
  await registerCapability(
    privateKey,
    {
      id: CAPABILITY_ID,
      name: 'Taste recommendations',
      description: 'Recommends movies, shows, music, places, books and more for a described taste, from the Qloo taste graph, explained by NVIDIA Nemotron.',
      category: 'Research',
      inputSchema: {
        type: 'object',
        properties: { request: { type: 'string', minLength: 3, maxLength: 500 }, count: { type: 'integer', minimum: 1, maximum: 10 } },
        required: ['request'],
        additionalProperties: false,
      },
      outputSchema: {
        type: 'object',
        properties: {
          summary: { type: 'string', maxLength: 500 },
          recommendations: {
            type: 'array',
            maxItems: 10,
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                category: { type: 'string' },
                why: { type: 'string', maxLength: 400 },
                qlooEntityId: { type: 'string' },
                confidence: { type: 'number', minimum: 0, maximum: 1 },
              },
              required: ['name', 'category', 'why', 'qlooEntityId', 'confidence'],
            },
          },
          mode: { enum: ['live'] },
        },
        required: ['summary', 'recommendations', 'mode'],
      },
      rubric: 'Every recommendation has a Qloo entity id, fits the request, and the reason refers to what the buyer asked for. No recommendation is invented.',
    },
    apiUrl
  )
  console.log(`published "${CAPABILITY_ID}" in the capability registry`)
}

const seller = createSellerAgent({
  privateKey,
  apiUrl,
  name: 'Taste Concierge',
  description: 'Taste-based recommendations from the Qloo taste graph, reasoned by NVIDIA Nemotron on Nebius Token Factory.',
  capability: CAPABILITY_ID,
  category: 'Research',
  price: 0.08,
  floor: 0.05,
  async handle(job) {
    const brief = briefSchema.parse(job.brief)
    const result = await engine.run(brief)
    // Never deliver fixtures as paid work. If the live path failed, deliver nothing and let the contract refund the buyer.
    if (result.mode !== 'live') throw new Error('Live services were unavailable, nothing delivered.')
    return result as unknown as Record<string, unknown>
  },
  async respondToDispute({ result, reason }) {
    const ids = Array.isArray(result.recommendations) ? (result.recommendations as { qlooEntityId?: string }[]).map((r) => r.qlooEntityId).join(', ') : ''
    return `Every recommendation carries a Qloo entity id (${ids}) that Qloo returned for this request, and the explanations come from the Nemotron model. Buyer's concern: ${reason ?? 'not given'}.`
  },
})

process.on('SIGINT', () => seller.stop())
process.on('SIGTERM', () => seller.stop())
await seller.start()
