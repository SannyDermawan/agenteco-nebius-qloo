# Devpost submission draft: Qloo Agentic Hackathon

Fill the real demo URL and repository URL before submitting. Do not submit until the live probe has run (see API-NOTES.md).

**Project name:** Taste Concierge (an AgentEco seller agent)

**Tagline:** An AI agent that sells taste recommendations from Qloo's taste graph, paid through escrow with a dispute path.

## Inspiration

AI agents are starting to hire each other, but a recommendation from a language model alone is easy to make up. We wanted an agent whose answers can be traced to a source. Qloo's taste graph gives each recommendation a real entity, and AgentEco's escrow gives the buyer a way to be refunded if the agent gets it wrong.

## What it does

A buyer (a person on the demo page, or another agent through AgentEco) describes a taste. Taste Concierge resolves what they already like with Qloo, asks Qloo Insights for matching entities across movies, shows, music, places, books and more, and returns recommendations that each carry a Qloo entity id and a short reason. If Qloo has no data, it says so instead of guessing.

## How we use Qloo

Qloo is the only source of recommendations. Entity search resolves the titles or places a person mentions, Insights returns the candidate entities (with Qloo's affinity score when present), and the agent treats that list as the only allowed answer set. A language model can choose and explain, but a verification step in code drops any pick that Qloo did not return. The agent cannot work without Qloo.

## How we built it

TypeScript and Node. The agent is a small pipeline (intent, Qloo search, Qloo insights, selection, verification). It plugs into AgentEco, an escrow, dispute and reputation layer for AI agent work, through the AgentEco SDK, so a buyer can hire it with a locked payment and dispute a bad delivery. NVIDIA Nemotron on Nebius Token Factory does the language work. 16 automated tests cover the Qloo client, the agent's verification and the server.

## What is new versus what existed

Existed before the hackathon: AgentEco (contracts, SDK, backend, website, 150 commits since 24 Sep 2026). New: the Taste Concierge agent, the Qloo integration, the Nemotron integration, the demo page, the hire script, the tests. The repository history shows both, with the tag `pre-nebius-qloo` marking the boundary.

## Qloo workflow used and why it fits

Entity search to ground what the person says they like, then Insights filtered by entity type with those entities as signals. It fits because the question "what would someone with this taste like next" is exactly what the taste graph answers; the language model only explains.

## Redacted example (fill from the first live run)

Request: "I loved Spirited Away and Princess Mononoke. What should I watch next?"
Qloo calls: search "Spirited Away" and "Princess Mononoke" (entity ids recorded), then insights for `urn:entity:movie` with those two ids as signals.
Result: the first three recommendations with their Qloo entity ids and affinity. (Paste from `npm run hire-demo` or the demo page's "Qloo calls" list; no credential appears in it.)

## Known limitations and what the results do not prove

Qloo affinity says how strongly an entity matches the signals, not that the person will enjoy it. The agent only uses entity signals (no location, demographics or tags yet). Reasons come from a language model and are explanations, not evidence. The demo has no real users and runs on test networks.

## Challenges

The public Qloo documentation leaves the entity fields untyped, so the client reads fields defensively and drops anything without an id. We also made the agent refuse to present fixtures as results: without keys it runs in a clearly labelled sample mode and will not sell.

## What is next

Location and tag signals, and letting buyers pay per recommendation through AgentEco on a public test network.

## Honest notes

AgentEco runs on test networks only; no real money. There are no real users outside the team yet.
