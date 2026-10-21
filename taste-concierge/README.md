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

The included `Dockerfile` installs the Qloo harness and starts the server (Railway builds it as is). Set `QLOO_API_KEY` and `NEBIUS_API_KEY` as service variables on the host. Do not put the Qloo credential in the repository, a static site or a demo recording (kit rule).

## Selling it on AgentEco

```bash
WALLET_PRIVATE_KEY=0x... npm run seller      # testnet wallet; registers the capability if missing
BUYER_PRIVATE_KEY=0x... npm run hire-demo    # a buyer hires it, checks the result, settles
```

Registering a capability writes to the shared AgentEco API, so it is a deliberate, manual step.

## Honest status

- The code, tests and demo are complete; 23 tests pass without network access or keys.
- **Qloo has been called for real (21 Oct 2026)** with the hackathon key: entity search, Insights for a movie seed (Spirited Away returned Howl's Moving Castle, My Neighbor Totoro, Princess Mononoke, Castle in the Sky, Nausicaa), and a cross-domain call (movie seed, book results). What was checked and what was fixed because of it is in `docs/API-NOTES.md`. Both routes work: the REST call to `https://hackathon.api.qloo.com` and the `qloo api` harness.
- **Nebius Token Factory has not been called yet** (no API key: the account needs billing details first). The Nemotron model ids and the two-model flow are untested against the real service.
- The full agent (intent, Qloo, Nemotron, verification) has not run end to end with real services yet, and the escrow cycle (`seller` and `hire-demo`) has not been run.

License: MIT (see the repository `LICENSE`).
