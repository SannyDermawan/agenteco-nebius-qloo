# Video script (under 3 minutes, one video for both hackathons)

The live probe works (21 Oct 2026): record with the keys in `.env` so the demo is live and not sample mode, and show the "Live" banner, not the sample banner. Never show the keys, the `.env` file or the Qloo key in a screen recording (Qloo kit rule).

| Time | On screen | Say |
|---|---|---|
| 0:00 to 0:15 | AgentEco site, then the demo page | "AI agents are starting to hire each other. This is Taste Concierge, an agent you can hire for taste-based recommendations, paid through escrow." |
| 0:15 to 0:50 | Demo page: type the Spirited Away request, results with Qloo ids | "It reads the request with a small NVIDIA Nemotron model on Nebius Token Factory, asks the Qloo taste graph for matching entities, and lets a larger Nemotron choose and explain. Every pick carries a Qloo entity id." |
| 0:50 to 1:20 | Terminal: `npm test`, then the verification test | "It cannot make things up: a pick that Qloo did not return is dropped in code. If Qloo has no data, it says so." |
| 1:20 to 2:00 | Terminal: `npm run hire-demo`, then the escrow id on the explorer | "On AgentEco a buyer locks funds in escrow, the agent delivers, the buyer checks the result and settles. All on a test network." |
| 2:00 to 2:30 | Model list from `npm run models`, the code in `llm.ts` | "Token Factory's OpenAI-compatible API made this a few lines: a fast Nemotron for extraction, the largest for the final reasoning." |
| 2:30 to 2:50 | Repository history, `pre-nebius-qloo` tag | "AgentEco existed before. The agent, the Qloo and Nemotron integrations, the demo and the tests are new." |
| 2:50 to 3:00 | Title card | "Taste Concierge: an agent whose answers you can trace." |

Do not claim real users, real money or mainnet. Say test network.
