import { openAiCompatible, type AiModel } from '@agenteco/sdk'

export const DEFAULT_NEBIUS_BASE = 'https://api.tokenfactory.nebius.com/v1/'

export interface Models {
  fast: { id: string; ai: AiModel }
  reasoning: { id: string; ai: AiModel }
}

/**
 * Chooses the Nemotron models to use from the ids Token Factory lists. Heavy reasoning goes to the largest family member
 * (Ultra, then Super), quick extraction to a small one (Nano). Anything else Nemotron is a fallback. Returns null when the
 * account lists no Nemotron model, so the caller can say so instead of silently using another family.
 */
export function pickNemotronModels(ids: string[]): { fast: string; reasoning: string } | null {
  const nemotron = ids.filter((id) => /nemotron/i.test(id))
  if (nemotron.length === 0) return null
  const first = (re: RegExp) => nemotron.find((id) => re.test(id))
  const reasoning = first(/ultra/i) ?? first(/super/i) ?? nemotron[0]!
  const fast = first(/nano/i) ?? first(/super/i) ?? reasoning
  return { fast, reasoning }
}

export async function listModelIds(apiKey: string, baseUrl = DEFAULT_NEBIUS_BASE, fetchImpl: typeof fetch = fetch): Promise<string[]> {
  const res = await fetchImpl(`${baseUrl.replace(/\/+$/, '')}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`Token Factory answered HTTP ${res.status} listing models`)
  const body = (await res.json()) as { data?: { id?: string }[] }
  return (body.data ?? []).map((m) => m.id).filter((id): id is string => typeof id === 'string')
}

/**
 * Builds the two model handles on Nebius Token Factory (OpenAI-compatible API) using the SDK's `openAiCompatible`.
 * Model ids come from NEBIUS_MODEL_FAST / NEBIUS_MODEL_REASONING when set, otherwise from the live model list.
 */
export async function resolveModels(env: NodeJS.ProcessEnv = process.env, fetchImpl: typeof fetch = fetch): Promise<Models> {
  const apiKey = env.NEBIUS_API_KEY
  if (!apiKey) throw new Error('NEBIUS_API_KEY is not set.')
  const baseUrl = env.NEBIUS_BASE_URL || DEFAULT_NEBIUS_BASE
  let fast = env.NEBIUS_MODEL_FAST
  let reasoning = env.NEBIUS_MODEL_REASONING
  if (!fast || !reasoning) {
    const picked = pickNemotronModels(await listModelIds(apiKey, baseUrl, fetchImpl))
    if (!picked) throw new Error('No NVIDIA Nemotron model is listed for this Token Factory account. Set NEBIUS_MODEL_FAST and NEBIUS_MODEL_REASONING.')
    fast ||= picked.fast
    reasoning ||= picked.reasoning
  }
  const make = (model: string) => openAiCompatible({ baseUrl, apiKey, model, timeoutMs: 90_000 })
  return { fast: { id: fast, ai: make(fast) }, reasoning: { id: reasoning, ai: make(reasoning) } }
}
