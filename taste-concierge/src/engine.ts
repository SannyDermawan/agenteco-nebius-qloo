import { recommend, heuristicIntent } from './agent.ts'
import { resolveModels } from './llm.ts'
import { createQlooAuto } from './qloo.ts'
import { sampleResult } from './fixtures.ts'
import type { Brief, TasteResult } from './types.ts'

export interface Engine {
  /** live = real Qloo and Nemotron calls; sample = labelled fixtures (a fallback, never passed off as live). */
  mode: 'live' | 'sample'
  reason?: string
  run(brief: Brief): Promise<TasteResult>
}

/**
 * Picks the mode from what is configured. With QLOO_API_KEY and NEBIUS_API_KEY set it is live. Without them (or with
 * TASTE_MODE=sample) it is the sample mode, and every result says so. If a live call fails at run time the engine
 * falls back to the sample result and adds a note, so a public demo keeps working while staying honest.
 */
export async function createEngine(env: NodeJS.ProcessEnv = process.env): Promise<Engine> {
  if (env.TASTE_MODE === 'sample') return sampleEngine('TASTE_MODE=sample')
  if (!env.QLOO_API_KEY || !env.NEBIUS_API_KEY) return sampleEngine('QLOO_API_KEY or NEBIUS_API_KEY is not set')
  try {
    const models = await resolveModels(env)
    const { client: qloo, transport } = await createQlooAuto(env)
    console.warn(`[engine] Qloo transport: ${transport}`)
    return {
      mode: 'live',
      async run(brief) {
        try {
          return await recommend(brief, { qloo, fast: models.fast.ai, reasoning: models.reasoning.ai, models: { fast: models.fast.id, reasoning: models.reasoning.id }, log: (m) => console.warn(`[agent] ${m}`) })
        } catch (error) {
          const fallback = sampleResult(brief, heuristicIntent(brief.request).categories)
          fallback.notes.unshift(`A live call failed (${(error as Error).message}), so this is the labelled sample answer.`)
          return fallback
        }
      },
    }
  } catch (error) {
    return sampleEngine(`live setup failed: ${(error as Error).message}`)
  }
}

function sampleEngine(reason: string): Engine {
  return {
    mode: 'sample',
    reason,
    async run(brief) {
      const result = sampleResult(brief, heuristicIntent(brief.request).categories)
      result.notes.unshift(`Sample mode: ${reason}.`)
      return result
    },
  }
}
