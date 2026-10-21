# Devpost submission draft: Nebius x NVIDIA Global AI Hackathon

Track: Best Apps and Agents. Before submitting: fill the demo URL and YouTube link; the repository is https://github.com/SannyDermawan/agenteco-nebius-qloo. `npm run probe`, the end-to-end agent and a full escrow cycle have been run live (21 Oct 2026).

**Project name:** Taste Concierge (an AgentEco seller agent)

**Tagline:** A paid AI agent that reasons with NVIDIA Nemotron on Nebius Token Factory and cites every answer.

## What it does

An AI agent that other agents or people can hire through escrow. It takes a description of someone's taste, gets candidate recommendations from the Qloo taste graph, and uses Nemotron to choose and explain the best ones. A code-level check keeps any pick that Qloo did not return out of the answer.

## How Nemotron on Token Factory is used

Two Nemotron calls per request at run time over the OpenAI-compatible API (`https://api.tokenfactory.nebius.com/v1/`):
- A small Nemotron model extracts intent from the request (categories, liked titles, mood) in a fraction of a second.
- The largest Nemotron available makes the final selection and writes the reasons, using only the candidates it is given.

Model ids come from Token Factory's own model list (28 models, 5 of them Nemotron); on 21 Oct 2026 the agent picked `nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B` for intent and `nvidia/Nemotron-3-Ultra-550b-a55b` for the final selection. Both returned JSON in under a second in the probe, and a full request (intent, Qloo calls, selection, check) took 10 to 18 seconds. Token Factory's fast serverless inference is what lets a paid agent job answer inside a short budget while still using a large reasoning model for the part that needs it.

## Why it fits "agents"

The agent is not only a chat box. It is a seller on AgentEco: a buyer locks funds in escrow, the agent delivers a schema-checked result, the buyer's own checks decide whether to settle, and a dispute goes to an arbiter. We ran the full cycle on Solana devnet on 21 Oct 2026: the price was negotiated (0.04 offered, 0.06 agreed), escrow #6 was funded in devnet USDC, the agent delivered four Qloo-grounded recommendations and the buyer settled. The same Nemotron-backed pipeline serves the public demo page.

## What is new versus what existed

Existed: AgentEco (escrow and dispute contracts, SDK, backend, website; 150 commits since 24 Sep 2026). New: the Taste Concierge agent, Qloo and Token Factory integrations, model discovery, the demo page, the hire script and 25 tests. The tag `pre-nebius-qloo` marks the boundary in the repository history.

## Built with

TypeScript, Node, the AgentEco SDK, NVIDIA Nemotron, Nebius Token Factory, Qloo.

## Honest notes

AgentEco runs on test networks with test tokens only. The demo page runs in a labelled sample mode when API keys are not configured and never presents fixtures as live output.
