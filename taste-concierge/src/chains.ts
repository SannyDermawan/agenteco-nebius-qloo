/**
 * Tells the SDK which AgentEco program and token mint to use on a Solana chain, the way the AgentEco CLI does:
 * the API's `GET /chains` lists them, and the SDK reads them from `AGENT_ECO_PROGRAM__<chain>` and `TOKEN_MINT__<chain>`.
 * A value already set in the environment wins.
 */
interface ChainInfo { chainId: string; family: string; agentEco?: string; token?: { address?: string } }

export async function configureChainsFromApi(apiUrl: string, env: NodeJS.ProcessEnv = process.env, fetchImpl: typeof fetch = fetch): Promise<string[]> {
  const res = await fetchImpl(`${apiUrl.replace(/\/+$/, '')}/chains`, { signal: AbortSignal.timeout(15_000) })
  if (!res.ok) throw new Error(`GET /chains answered HTTP ${res.status}`)
  const chains = (await res.json()) as ChainInfo[]
  const configured: string[] = []
  for (const c of chains) {
    if (c.family !== 'solana' || !c.agentEco) continue
    const suffix = c.chainId.replace(/[^A-Za-z0-9]/g, '_')
    env[`AGENT_ECO_PROGRAM__${suffix}`] ||= c.agentEco
    if (c.token?.address) env[`TOKEN_MINT__${suffix}`] ||= c.token.address
    configured.push(c.chainId)
  }
  return configured
}
