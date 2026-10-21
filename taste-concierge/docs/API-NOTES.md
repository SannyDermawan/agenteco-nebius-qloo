# API notes: what is verified and what is not

Read from the official documentation on 20 Oct 2026. The first version was written without keys. Both services were called for real on 21 Oct 2026; see "Confirmed live" at the end and the Nebius results below it.

## Qloo

Source: docs.qloo.com (Knowledge Center index, API onboarding, Insights API, Search Entities).

| Item | From the docs | Status |
|---|---|---|
| Auth | Header `X-Api-Key: <key>` | documented |
| Key | Issued by Qloo (support or the hackathon resources) | documented |
| Entity search | `GET https://api.qloo.com/search?query=...&take=...` returns `{ success, duration, results: [entity] }` | documented |
| Insights | `GET https://api.qloo.com/v2/insights` with `filter.type` (required, for example `urn:entity:movie`), optional `signal.interests.entities` (comma separated entity ids), `take` (default 20, max 50). Response `{ success, results: { entities: [...], duration } }` | documented |
| Entity fields | The public spec leaves the entity fields untyped. The client reads `entity_id`, `name`, `types`, `properties.description`, `tags[].name`, `query.affinity`, `popularity` and ignores everything else. An entity without an id or name is dropped | confirmed live (see the end of this file) |
| Base URL | The onboarding page shows `https://staging.api.qloo.com/v2` in its examples, the Insights reference shows `https://api.qloo.com/v2/insights`. The client defaults to `https://api.qloo.com` and `QLOO_BASE_URL` overrides it | **confirm which host the hackathon key is issued for** |
| Rate limits | Not stated. A 429 returns `{ code, reason, message }`. The client retries 429 and 5xx twice with backoff | not documented |

Not used because the docs reviewed do not describe them: tag signals, location filters, demographics, explainability. They can be added once confirmed.

## How the hackathon issues access (important)

Source: the Qloo hackathon kit, https://github.com/qloo/qloo-hackathon-kit (linked from the Devpost Resources tab), read 20 Oct 2026.

- The credential is **event-issued and individually attributable**. The kit installs `@qloo/qloo-harness` (version 0.1.26 or newer) and stores the credential with `qloo setup --qloo`. Supported surfaces: `qloo explore`, `qloo exec`, `qloo api`, `qloo mcp`. All count against the same quota.
- Rules from `docs/API_ACCESS.md`: do not put the credential in source control, a browser app, a public MCP configuration or a demo recording; do not share it between teams; no bulk scraping; keep retries bounded; the quota, rate limit and expiry are published by the organizers.
- **Answered by the kit (docs/API_ACCESS.md):** the event credential is only supported through `qloo explore`, `qloo exec`, `qloo api` and `qloo mcp` from `@qloo/qloo-harness`, and must not be put in a browser app or a demo recording. `src/qloo.ts` therefore calls `qloo api search ... --json` and `qloo api insights ... --json` as a child process (arguments as an array, key in the environment) by default; `QLOO_TRANSPORT=rest` keeps the direct client. A hosted backend must have the harness installed (see the Dockerfile note in the README).
- **Earlier open question, now answered (REST with `X-Api-Key` against the hackathon host works):** whether the event credential also works as a plain `X-Api-Key` against the REST host (what `QlooClient` assumes), or only through the harness or an organizer gateway. The kit does not state a base URL. **First thing to do with the key:** run `npm run probe`. If the REST call is rejected, ask in the Qloo Discord (linked from the kit) how a deployed backend should call Qloo, and change only `src/qloo.ts`.
- The credential stays on the server (`.env`, never sent to the browser, never in the repository or the video). The demo page talks only to this server's `/api/recommend`.
- The kit's submission guide asks for: the Qloo workflow used and why, a **redacted** example request and result with the entity choices, a short demo, setup from a clean environment and known limitations including what the results do not prove. `docs/SUBMISSION-QLOO.md` follows that list.

## Nebius Token Factory

Source: docs.tokenfactory.nebius.com (quickstart, API reference index).

| Item | From the docs | Status |
|---|---|---|
| Base URL | `https://api.tokenfactory.nebius.com/v1/` | documented |
| Auth | `Authorization: Bearer $NEBIUS_API_KEY` | documented |
| Chat | `POST /chat/completions`, OpenAI compatible. The SDK's `openAiCompatible` sends `response_format: json_object` | compatible per docs, **confirm JSON mode on the chosen model** |
| Model list | `GET /models` ("List models API") | documented, used by `npm run models` |
| Nemotron ids | Nebius's Nemotron page (nebius.com/services/token-factory/nemotron) lists Nemotron 3 Nano 30b, Nano Omni, Super 120b and Ultra 550b, and its code sample uses the id **`nvidia/nemotron-3-super-120b-a12b`** (lowercase), the only id confirmed from Nebius itself. The Nano and Ultra ids are not shown. Third-party catalogs show ids like `nvidia/Nemotron-3-Ultra-550b-a55b`, unconfirmed | **Super is confirmed. For the rest the agent reads `/models` and picks (matching is case-insensitive), or you set `NEBIUS_MODEL_FAST` and `NEBIUS_MODEL_REASONING`. If no Ultra is listed, Super is used for both roles** |

## Live probe results

(empty until `npm run probe` has run with real keys)


## Confirmed live on 21 Oct 2026 (hackathon key)

| Check | Result |
|---|---|
| Host | The key works only against `https://hackathon.api.qloo.com`; `api.qloo.com` and the staging host answer 401 (Qloo's hackathon developer guide). The client now defaults to the hackathon host |
| Auth | `X-Api-Key` header, GET, as the client already did |
| `/search` | `{ results: [ { entity_id, name, types, properties } ] }`; a query can return several kinds ("Spirited Away" is a movie and an album) |
| `/v2/insights` with `filter.type` and `signal.interests.entities` | `{ success, results: { entities: [ ... ] } }` with `query.affinity` (0 to 1), `popularity`, tags and a description. Entities have **no `types`** and a bare `type` of `urn:entity`, so the requested kind is filled in by the client |
| Cross-domain signal | A movie seed with `filter.type=urn:entity:book` works (American Gods, Stardust) |
| Insights without any signal | HTTP 400. The agent already treats a failing category as "no data" |
| Video games | The type is `urn:entity:video_game` (not `videogame`); fixed |
| Harness | `qloo api search` and `qloo api insights --json` print a **bare array**; the harness needs `QLOO_BASE_URL` and `QLOO_TRUSTED_BASE_URL` set to the hackathon host, which `QlooHarnessClient` does. The client reads both shapes |
| Transport | Left unset, the server uses the harness when `qloo` is installed and REST otherwise, and logs which |

## Confirmed live: Nebius Token Factory (21 Oct 2026)

| Check | Result |
|---|---|
| Models | `GET /models` lists 28 models, 5 of them Nemotron: `nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B`, `nvidia/Nemotron-3_5-Lightning`, `nvidia/Nemotron-3-Ultra-550b-a55b`, `nvidia/nemotron-3-super-120b-a12b`, `nvidia/Nemotron-3.5-Super-VL` |
| Choice | Without overrides the agent picks the Nano 30B as the fast model and the Ultra 550B as the reasoning model |
| JSON replies | Both returned the requested JSON in under a second in the probe |
| Credit | The hackathon promo code ($25) was applied; the account shows a $25 balance and a $1 trial credit |
| End to end | Two real requests ran through intent extraction, Qloo search and insights, Nemotron selection and the code-side check against Qloo's list: about 10 s (movies) and 18 s (artists and books) |
