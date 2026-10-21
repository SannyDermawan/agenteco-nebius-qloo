# Devpost submission draft: Qloo Agentic Hackathon

Before submitting: fill the demo URL (or video link) and keep the repository URL https://github.com/SannyDermawan/agenteco-nebius-qloo. The live probe, the end-to-end agent and a full escrow cycle on Solana devnet have been run (21 Oct 2026); see API-NOTES.md and QLOO-WALKTHROUGH.md.

**Project name:** Taste Concierge (an AgentEco seller agent)

**Tagline:** An AI agent that sells taste recommendations from Qloo's taste graph, paid through escrow with a dispute path.

## Inspiration

AI agents are starting to hire each other, but a recommendation from a language model alone is easy to make up. We wanted an agent whose answers can be traced to a source. Qloo's taste graph gives each recommendation a real entity, and AgentEco's escrow gives the buyer a way to be refunded if the agent gets it wrong.

## What it does

A buyer (a person on the demo page, or another agent through AgentEco) describes a taste. Taste Concierge resolves what they already like with Qloo, asks Qloo Insights for matching entities across movies, shows, music, places, books and more, and returns recommendations that each carry a Qloo entity id and a short reason. If Qloo has no data, it says so instead of guessing.

## How we use Qloo

Qloo is the only source of recommendations. Entity search resolves the titles or places a person mentions, Insights returns the candidate entities (with Qloo's affinity score when present), and the agent treats that list as the only allowed answer set. A language model can choose and explain, but a verification step in code drops any pick that Qloo did not return. The agent cannot work without Qloo.

## How we built it

TypeScript and Node. The agent is a small pipeline (intent, Qloo search, Qloo insights, selection, verification). It plugs into AgentEco, an escrow, dispute and reputation layer for AI agent work, through the AgentEco SDK, so a buyer can hire it with a locked payment and dispute a bad delivery. NVIDIA Nemotron on Nebius Token Factory does the language work. 25 automated tests cover the Qloo client, the agent's verification and the server.

## What is new versus what existed

Existed before the hackathon: AgentEco (contracts, SDK, backend, website, 150 commits since 24 Sep 2026). New: the Taste Concierge agent, the Qloo integration, the Nemotron integration, the demo page, the hire script, the tests. The repository history shows both, with the tag `pre-nebius-qloo` marking the boundary.

## Qloo workflow used and why it fits

Entity search to ground what the person says they like, then Insights filtered by entity type with those entities as signals. It fits because the question "what would someone with this taste like next" is exactly what the taste graph answers; the language model only explains.

## Redacted example (from a real run, 21 Oct 2026)

Request: "I loved Spirited Away and Princess Mononoke. What should I watch next?"
Qloo calls: entity search for "Spirited Away" and "Princess Mononoke" (the top hit of each is the seed), then `GET /v2/insights?filter.type=urn:entity:movie&signal.interests.entities=<the two ids>` on the hackathon host.
Result: Howl's Moving Castle, My Neighbor Totoro, Castle in the Sky and Nausicaa of the Valley of the Wind, each with its Qloo entity id; Qloo's own affinity for the top candidates was 0.94 to 0.97. The same request went through AgentEco escrow on Solana devnet (escrow #6, 0.06 USDC, settled). The step-by-step explanation is in `taste-concierge/docs/QLOO-WALKTHROUGH.md`. No key or raw Qloo payload appears in the repository.

## Known limitations and what the results do not prove

Qloo affinity says how strongly an entity matches the signals, not that the person will enjoy it. The agent only uses entity signals (no location, demographics or tags yet). Reasons come from a language model and are explanations, not evidence. The demo has no real users and runs on test networks.

## Challenges

The public Qloo documentation leaves the entity fields untyped, so the first client read fields defensively; running it for real found four things we had wrong: the hackathon key only works on its own host, the harness prints a bare array, Insights entities carry no kind, and video games are `urn:entity:video_game`. We fixed each and added a test for it. The client reads fields defensively and drops anything without an id. We also made the agent refuse to present fixtures as results: without keys it runs in a clearly labelled sample mode and will not sell.

## What is next

Location and tag signals (valid tag ids from `/v2/tags`), and letting buyers pay per recommendation through AgentEco on a public test network (already working on Solana devnet).

## Honest notes

AgentEco runs on test networks only; no real money. There are no real users outside the team yet.
