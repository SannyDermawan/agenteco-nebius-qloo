// Runs one full AgentEco escrow cycle against the Taste Concierge seller on a TEST network:
// the buyer escrows a small amount, the seller delivers, the buyer checks the result and settles.
// The seller must be running (npm run seller). Usage: BUYER_PRIVATE_KEY=0x... npm run hire-demo
// Keys come from the environment and are never printed. Prints the transaction-related ids for the README.
import { hire, DEFAULT_API_URL } from '@agenteco/sdk'
import { CAPABILITY_ID, recommendationSchema } from '../src/types.ts'
import { z } from 'zod'

const privateKey = process.env.BUYER_PRIVATE_KEY as `0x${string}` | undefined
if (!privateKey) throw new Error('Missing BUYER_PRIVATE_KEY in .env (a testnet wallet funded with test tokens and gas).')
const apiUrl = process.env.AGENTECO_API_URL ?? DEFAULT_API_URL

const result = await hire({
  privateKey,
  apiUrl,
  capability: CAPABILITY_ID,
  brief: { request: 'I loved Spirited Away and Princess Mononoke. What should I watch next?', count: 4 },
  criteria: 'Each recommendation carries a Qloo entity id and the reason refers to the films I named.',
  maxBudget: 0.12,
  // The buyer checks the delivery itself before paying: schema, ids present, reasons non-empty.
  review: (delivered) => {
    const parsed = z.object({ recommendations: z.array(recommendationSchema).min(1), mode: z.literal('live') }).safeParse(delivered)
    return parsed.success ? { accept: true } : { accept: false, reason: `The delivery did not match the agreed shape: ${parsed.error.issues[0]?.message ?? 'invalid'}` }
  },
})

console.log('outcome:', result.outcome)
console.log('escrow id:', String(result.escrowId))
console.log('seller:', result.seller.name, result.seller.wallet)
console.log('price:', result.price)
console.log('recommendations:', JSON.stringify((result.result as { recommendations?: unknown[] } | null)?.recommendations ?? [], null, 2))
