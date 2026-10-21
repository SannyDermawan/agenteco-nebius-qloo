# Taste Concierge

**An AI agent that sells taste recommendations from the Qloo taste graph, reasoned by NVIDIA Nemotron on Nebius Token Factory, paid through AgentEco escrow.** One codebase, two hackathon submissions: the **Nebius x NVIDIA Global AI Hackathon** (track: Best Apps and Agents) and the **Qloo Agentic Hackathon**.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

- Agent and demo: [taste-concierge/](taste-concierge/README.md)
- What changed for these hackathons: [`pre-nebius-qloo...main`](https://github.com/SannyDermawan/agenteco-nebius-qloo/compare/pre-nebius-qloo...main)
- Original open source project (MIT): [SannyDermawan/agenteco-multichain](https://github.com/SannyDermawan/agenteco-multichain), described in [AGENTECO.md](AGENTECO.md)
- Submission drafts: [Qloo](taste-concierge/docs/SUBMISSION-QLOO.md), [Nebius](taste-concierge/docs/SUBMISSION-NEBIUS.md)

## What it does

A person (or another agent) describes a taste: "I loved Spirited Away and Princess Mononoke, what should I watch next?" Taste Concierge:

1. reads the request with a small **Nemotron** model on **Nebius Token Factory** (categories, things the person likes, mood),
2. resolves what they like with the **Qloo** entity search and asks **Qloo Insights** for similar entities,
3. lets a larger **Nemotron** model choose and explain the best ones, using only Qloo's candidates,
4. checks every pick in code against what Qloo returned and drops anything it did not, so the agent cannot recommend something it made up.

If Qloo has nothing, it says "no data". Every recommendation carries its Qloo entity id. Without Qloo the agent has no answer.

It is also a seller on [AgentEco](AGENTECO.md), an escrow, dispute and reputation layer for AI agent work: a buyer locks funds in escrow, the agent delivers a schema-checked result, the buyer's own checks decide whether to settle, and a dispute goes to an arbiter. The same pipeline serves the public demo page.

## How Qloo is used

Qloo is the only source of recommendations: entity search to ground the titles a person mentions, Insights (filtered by entity type, with those entities as signals) for the candidates. The agent treats Qloo's list as the only allowed answer set. A redacted example of a request and its result is in [the Qloo submission draft](taste-concierge/docs/SUBMISSION-QLOO.md); the access rules for the hackathon credential and what is still to be confirmed are in [taste-concierge/docs/API-NOTES.md](taste-concierge/docs/API-NOTES.md).

## How Nemotron on Nebius Token Factory is used

Two runtime calls per request through the OpenAI-compatible API at `https://api.tokenfactory.nebius.com/v1/`: a small Nemotron model for intent extraction, the largest available for the final choice and explanation. Model ids come from Token Factory's own `/models` list (or `.env`). Fast inference matters because a paid agent job has a time budget; the large model is only used where reasoning is needed.

## Architecture

```
buyer (AgentEco escrow) -> seller.ts -> agent.ts
                                          |-- Nemotron (small): intent
                                          |-- Qloo (search, insights): candidates
                                          |-- Nemotron (large): choose and explain
                                          '-- verify every pick against Qloo's list -> result
public demo: browser -> server.ts -> agent.ts (same code, no escrow)
```

## Try it

```bash
cd taste-concierge
npm install
npm test                  # 16 tests, no network or keys needed
cp .env.example .env      # QLOO_API_KEY and NEBIUS_API_KEY (names only here)
npm run models            # lists the Nemotron models your key can use
npm run probe             # three real calls to each service
npm start                 # demo on http://localhost:8787
```

Without keys the demo runs in a **labelled sample mode** (fixed examples, ids that start with `sample:`, a banner on the page, `"mode": "sample"` in every response), and the seller refuses to sell in that mode. Fixtures are never passed off as live output.

## What existed before and what is new

**Before (tag `pre-nebius-qloo`, 150 commits since 24 Sep 2026):** AgentEco itself: escrow and dispute contracts, the arbiter, reputation, the SDK, backend, CLI and website. See [AGENTECO.md](AGENTECO.md) and the [project history](#project-history).

**New (commits after the tag, all in `taste-concierge/`):** the Qloo client, the Token Factory client with model discovery, the agent pipeline and its verification step, the AgentEco seller wrapper, the demo server and page, the hire and probe scripts, 16 tests, the API notes and the submission texts.

## Honest status

- Code, tests and demo are complete and pass without network access.
- **Both services have been called for real (21 Oct 2026).** Qloo (hackathon key): entity search, Insights with a movie seed (Spirited Away gave Howl's Moving Castle, My Neighbor Totoro, Princess Mononoke), a cross-domain call (movie seed, book results). Nebius Token Factory: 28 models listed, 5 Nemotron, and the agent picked `nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B` (fast) and `nvidia/Nemotron-3-Ultra-550b-a55b` (reasoning). The whole agent ran end to end on two requests (movies from Ghibli seeds; artists and books from Radiohead and Beck, about 10 and 18 seconds); every recommendation came from Qloo's own list. What each check found, and the bugs it exposed, is in `taste-concierge/docs/API-NOTES.md`.
- The escrow cycle ran for real on **Solana devnet** (21 Oct 2026): the Taste Concierge seller (wallet `3PnvSWL5...ZajyFX`) was listed on the live multi-chain API, a buyer wallet hired it, the price was negotiated (offered 0.04, the seller asked 0.07, counter 0.05, the seller asked 0.06, accepted), escrow #6 was funded in devnet USDC, the seller delivered four recommendations, the buyer's own check (schema, Qloo entity ids present, live mode) accepted, and the escrow settled with 0.06 USDC paid to the seller. The command that does this is `npm run seller` and `npm run hire-demo`; it also registered the `taste_recommendations` capability in the shared registry.
- AgentEco runs on test networks only, no real money, and has no real users outside the team.

## Project history

AgentEco grew in three stages across three repositories, all sharing one history that starts with the first commit on 24 Sep 2026. This repository keeps that history intact.

| Period | What happened |
|---|---|
| 24 Sep | First MVP: escrow, seller and buyer agents, a first BOT Chain deployment ([agenteco](https://github.com/SannyDermawan/agenteco), 16 commits) |
| 25 to 29 Sep | Foundry contract project, hashed task and result commitments, state-based escrow discovery, RPC failover, separate host loops for buyers, sellers and the arbiter, API hardening |
| 1 to 7 Oct | Night-market landing page, AI-required platform capabilities, faucet strip and the dispute walkthrough ([agenteco-bnb](https://github.com/SannyDermawan/agenteco-bnb), 78 commits) |
| 10 to 13 Oct | One-prompt onboarding with the staged `hire()` SDK, CLI and MCP server; Solana program and adapter; deployments with proof runs on Base, Ethereum, Arbitrum and Tempo testnets and BOT Chain; ERC-8004 identity ([agenteco-multichain](https://github.com/SannyDermawan/agenteco-multichain), 150 commits) |
| 17 Oct | Tag `pre-nebius-qloo`: the baseline for these hackathons |
| 20 Oct onward | The work in this repository |

## License

MIT, see [LICENSE](LICENSE).
