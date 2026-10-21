# Qloo request-to-result walkthrough (redacted)

This is the "request to result" explanation the Qloo hackathon submission guide asks for. It comes from a real run on 21 Oct 2026 with the hackathon key against `https://hackathon.api.qloo.com`. No key, no raw API payload and no personal data appear here: the Qloo response data is not stored in this repository (the Qloo developer guide asks participants not to publish it), only the names the agent chose and the numbers it reported.

## The problem

An AI agent that is asked "what should I watch next?" guesses. This agent only recommends what Qloo's taste graph returns for the tastes the person names, and says "no data" when Qloo has nothing.

## One request, step by step

**Request** (what a buyer or a visitor types): "I loved Spirited Away and Princess Mononoke, what should I watch next?"

| Step | What happens | Qloo workflow used and why |
|---|---|---|
| 1. Intent | A small Nemotron model reads the sentence and returns JSON: the category (movie) and the two things the person likes | None (Nebius). Qloo is not given the free text, only the extracted titles |
| 2. Resolve the likes | `GET /search?query=Spirited Away` and the same for Princess Mononoke. The top hit of each becomes a seed entity | **Entity search.** Titles are ambiguous (the same name can be a film and an album), so the agent keeps the Qloo entity id, not the string |
| 3. Candidates | `GET /v2/insights?filter.type=urn:entity:movie&signal.interests.entities=<seed ids>&take=8` | **Insights with entity signals.** This is where the taste graph answers: entities that people with these affinities also like, with an affinity score |
| 4. Choose and explain | A large Nemotron model gets only Qloo's candidates and picks the best fits and writes one reason for each | None (Nebius). It may not add anything of its own |
| 5. Check in code | Every pick must carry the Qloo entity id of a candidate from step 3. Anything else is dropped before the answer leaves the agent | The guard that makes Qloo the only source of recommendations |

**Result** (four films, each with a Qloo entity id): Howl's Moving Castle, My Neighbor Totoro, Castle in the Sky, Nausicaa of the Valley of the Wind. The sources list in the response shows the two searches and the insights call that produced them. Qloo's own affinity for the top candidates for a single seed was between 0.94 and 0.97; the agent reports its own confidence per pick next to Qloo's id, and the two are not the same thing.

## Entity and tag choices

- Entity choice: the top search hit for each named title. If it is wrong (for example a different "Beck"), the result is wrong; the response lists which entity each title resolved to so a human can see it.
- Tags: not used in this version. Insights are driven by entity signals only. Free-text tags are not passed to Qloo, because the guide requires valid tag ids from `/v2/tags`, not free strings.
- Cross-domain: a movie seed with `filter.type=urn:entity:book` also works (checked live), so a request for "a book like this film" is answered from Qloo too.

## What Qloo's results do and do not say

- Affinities describe groups of people, not the person asking. The agent never sends names, e-mail addresses or other personal data to Qloo, only titles and artists the person typed.
- An affinity is not a causal claim and not a probability that this person will like the title. The explanation text is the model's interpretation of Qloo's list and is labelled as such in the response.
- Insights without any signal are rejected by Qloo (HTTP 400). In that case the agent reports "no data" for that category rather than filling the gap.
- Quotas and expiry: the key is personal, rate limited, and stops working after the judging period. It lives only in the server's environment (`.env`, git-ignored, or the host's variables), never in a browser, a repository or a demo recording.

## Reproduce it from a clean environment

1. Node 22.19 or newer. `git clone` this repository, then `npm ci` in `agent-runtime/` and in `taste-concierge/`.
2. Get a hackathon key from the Qloo form linked on the hackathon's Resources tab, and a Nebius Token Factory key.
3. `cp taste-concierge/.env.example taste-concierge/.env` and fill `QLOO_API_KEY` and `NEBIUS_API_KEY`.
4. `npm run probe` makes three real calls to each service. `npm start` serves the demo on http://localhost:8787.
5. Optional: `npm install -g @qloo/qloo-harness` (0.1.26 or newer). If it is installed the agent calls Qloo through `qloo api`, otherwise through the documented REST call; the log says which.

## Known limitations

- The seed is the top search hit; an ambiguous title can resolve to the wrong entity.
- One insights call per category with at most eight candidates; there is no personalisation beyond the named seeds.
- Latency is 10 to 20 seconds per request (two model calls and several Qloo calls).
- The agent was exercised on a handful of requests, not evaluated at scale.
