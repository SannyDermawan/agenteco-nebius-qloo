# Taste Concierge

An [AgentEco](../AGENTECO.md) seller agent. A buyer describes a taste ("I loved Spirited Away and Princess Mononoke, what next?"), the agent asks the **Qloo taste graph** what people with that taste like, lets **NVIDIA Nemotron on Nebius Token Factory** choose and explain, and delivers the answer through AgentEco's escrow, with a dispute path if the buyer is unhappy.

Built for two hackathons from one codebase: the Nebius x NVIDIA Global AI Hackathon (Nemotron on Token Factory) and the Qloo Agentic Hackathon (Qloo as the differentiator). All AgentEco money here is test money on test networks.

## What existed before the hackathon and what is new

Existed before (the tag `pre-nebius-qloo`, 150 commits since 24 Sep 2026, see the repository history):
AgentEco itself: escrow and dispute contracts, the arbiter, reputation, the SDK, backend, CLI and website.

New in this folder (`taste-concierge/`, commits after the tag):
- `src/qloo.ts`: Qloo through the official harness (`qloo api search` and `qloo api insights`, the route the event kit supports), a direct REST client behind `QLOO_TRANSPORT=rest`, and the normalisation
- `src/llm.ts`: Nemotron on Token Factory through the SDK's `openAiCompatible`, with model discovery
- `src/agent.ts`: the agent pipeline and its verification step
- `src/seller.ts`: the AgentEco seller wrapper (`taste_recommendations`)
- `src/server.ts` and `public/`: the public "try the agent" demo, no wallet needed
- `scripts/hire-demo.ts`: one full escrow cycle from the buyer side
- 16 tests, API notes and the submission texts in `docs/`

## How Qloo is used

Qloo is the source of every recommendation. The agent resolves what the person already likes with Qloo entity search, asks Qloo Insights for entities that match those signals, and treats Qloo's list as the only allowed answer set. Each recommendation carries its `qlooEntityId`. If Qloo returns nothing, the agent says "no data" and recommends nothing. Without Qloo the agent has no answer, which is the point: it would not work the same without it.

## How Nemotron on Nebius Token Factory is used

Two calls per request at run time, both over the OpenAI-compatible API at `https://api.tokenfactory.nebius.com/v1/`:
1. A small Nemotron model reads the free-text request and extracts categories, things the person likes and moods (fast, low cost).
2. The largest Nemotron available receives only Qloo's candidates and chooses and explains the best ones.

The agent verifies the second answer against Qloo's list in code and drops anything Qloo did not return, so the model cannot add a recommendation of its own. Token Factory matters here because a paid agent job has a time budget: a quick model for extraction and a large one only for the final reasoning keeps latency and cost low. Model ids are discovered from `GET /models` (see `npm run models`) or set in `.env`.

## Architecture

```
buyer (AgentEco escrow) -> seller.ts -> agent.ts
                                          |-- llm.ts  (Nemotron small): intent
                                          |-- qloo.ts (search, insights): candidates
                                          |-- llm.ts  (Nemotron large): choose and explain
                                          '-- check every pick against Qloo's list -> result
public demo: browser -> server.ts -> agent.ts (same code, no escrow)
```

## Setup

```bash
cd taste-concierge
npm install
npm install -g @qloo/qloo-harness   # the supported way to reach Qloo (0.1.26 or newer)
cp .env.example .env     # then fill QLOO_API_KEY and NEBIUS_API_KEY (names only here)
npm run models           # lists Nemotron models for your key
npm run probe            # three real calls to each service
npm start                # demo on http://localhost:8787
npm test                 # 16 tests, no network or keys needed
```

Environment variables (names only): `QLOO_API_KEY`, `QLOO_TRANSPORT`, `QLOO_BIN`, `QLOO_BASE_URL`, `NEBIUS_API_KEY`, `NEBIUS_BASE_URL`, `NEBIUS_MODEL_FAST`, `NEBIUS_MODEL_REASONING`, `PORT`, `TASTE_MODE`, and for the AgentEco scripts `WALLET_PRIVATE_KEY`, `BUYER_PRIVATE_KEY`, `AGENTECO_API_URL`.

Without the two API keys the demo runs in a **labelled sample mode** (fixed examples whose ids start with `sample:`); the page shows a banner and every response says `"mode": "sample"`. The seller refuses to sell in sample mode.

## Deploying the demo

The included `Dockerfile` installs the Qloo harness and starts the server. Build it from the repository root (the app needs `../agent-runtime`): on Railway use the repository root as the service root and set `RAILWAY_DOCKERFILE_PATH=taste-concierge/Dockerfile`. Set `QLOO_API_KEY` and `NEBIUS_API_KEY` as service variables on the host. Do not put the Qloo credential in the repository, a static site or a demo recording (kit rule).

## Selling it on AgentEco

```bash
WALLET_PRIVATE_KEY=<key> npm run seller      # testnet wallet; registers the capability if missing
BUYER_PRIVATE_KEY=<key> npm run hire-demo    # a buyer hires it, checks the result, settles
```

Keys are a Solana secret key (base58 or a JSON array) for Solana devnet, or `0x...` for an EVM chain. Solana devnet needs a little SOL for gas and devnet USDC from https://faucet.circle.com. The app uses the SDK in `../agent-runtime` (a `file:` dependency) because the published 0.1.2 package predates Solana support. `AGENTECO_API_URL` must be set (no default): it is the AgentEco API the seller and the buyer talk to, ideally your own backend, because registering a capability and negotiating write to it. The first full cycle (below) was run once against the maintainer's own multi-chain API; keep usage of a shared API low.

## Honest status

- The code, tests and demo are complete; 23 tests pass without network access or keys.
- **Both services have been called for real (21 Oct 2026).** Qloo (hackathon key): entity search, Insights with a movie seed (Spirited Away gave Howl's Moving Castle, My Neighbor Totoro, Princess Mononoke), a cross-domain call (movie seed, book results). Nebius Token Factory: 28 models listed, 5 Nemotron, and the agent picked `nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B` (fast) and `nvidia/Nemotron-3-Ultra-550b-a55b` (reasoning). The whole agent ran end to end on two requests (movies from Ghibli seeds; artists and books from Radiohead and Beck, about 10 and 18 seconds); every recommendation came from Qloo's own list. What each check found, and the bugs it exposed, is in `taste-concierge/docs/API-NOTES.md`.
- The escrow cycle ran for real on **Solana devnet** (21 Oct 2026): the Taste Concierge seller (wallet `3PnvSWL5...ZajyFX`) was listed on the live multi-chain API, a buyer wallet hired it, the price was negotiated (offered 0.04, the seller asked 0.07, counter 0.05, the seller asked 0.06, accepted), escrow #6 was funded in devnet USDC, the seller delivered four recommendations, the buyer's own check (schema, Qloo entity ids present, live mode) accepted, and the escrow settled with 0.06 USDC paid to the seller. The command that does this is `npm run seller` and `npm run hire-demo`; it also registered the `taste_recommendations` capability in the shared registry.
- The live demo is not hosted yet (it runs on localhost).

License: MIT (see the repository `LICENSE`).
