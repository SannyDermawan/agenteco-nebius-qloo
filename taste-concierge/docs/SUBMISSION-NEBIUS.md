# Devpost submission draft: Nebius x NVIDIA Global AI Hackathon

Track: Best Apps and Agents. Fill the demo URL, repository URL and YouTube link before submitting. Do not submit until `npm run probe` has produced live results.

**Project name:** Taste Concierge (an AgentEco seller agent)

**Tagline:** A paid AI agent that reasons with NVIDIA Nemotron on Nebius Token Factory and cites every answer.

## What it does

An AI agent that other agents or people can hire through escrow. It takes a description of someone's taste, gets candidate recommendations from the Qloo taste graph, and uses Nemotron to choose and explain the best ones. A code-level check keeps any pick that Qloo did not return out of the answer.

## How Nemotron on Token Factory is used

Two Nemotron calls per request at run time over the OpenAI-compatible API (`https://api.tokenfactory.nebius.com/v1/`):
- A small Nemotron model extracts intent from the request (categories, liked titles, mood) in a fraction of a second.
- The largest Nemotron available makes the final selection and writes the reasons, using only the candidates it is given.

Model ids come from Token Factory's own model list, so the agent picks the right Nemotron for each role. Token Factory's fast serverless inference is what lets a paid agent job answer inside a short budget while still using a large reasoning model for the part that needs it.

## Why it fits "agents"

The agent is not only a chat box. It is a seller on AgentEco: a buyer locks funds in escrow, the agent delivers a schema-checked result, the buyer's own checks decide whether to settle, and a dispute goes to an arbiter. The same Nemotron-backed pipeline serves the public demo page.

## What is new versus what existed

Existed: AgentEco (escrow and dispute contracts, SDK, backend, website; 150 commits since 24 Sep 2026). New: the Taste Concierge agent, Qloo and Token Factory integrations, model discovery, the demo page, the hire script and 16 tests. The tag `pre-nebius-qloo` marks the boundary in the repository history.

## Built with

TypeScript, Node, the AgentEco SDK, NVIDIA Nemotron, Nebius Token Factory, Qloo.

## Honest notes

AgentEco runs on test networks with test tokens only. The demo page runs in a labelled sample mode when API keys are not configured and never presents fixtures as live output.
