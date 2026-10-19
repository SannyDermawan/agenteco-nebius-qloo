# API notes: what is verified and what is not

Read from the official documentation on 20 Oct 2026. No API key was available when this was written, so **no live call to Qloo or Nebius has been made yet**. `npm run probe` makes the three calls to each service and prints the results; paste its output into the section "Live probe results" below once the keys are in `.env`.

## Qloo

Source: docs.qloo.com (Knowledge Center index, API onboarding, Insights API, Search Entities).

| Item | From the docs | Status |
|---|---|---|
| Auth | Header `X-Api-Key: <key>` | documented |
| Key | Issued by Qloo (support or the hackathon resources) | documented |
| Entity search | `GET https://api.qloo.com/search?query=...&take=...` returns `{ success, duration, results: [entity] }` | documented |
| Insights | `GET https://api.qloo.com/v2/insights` with `filter.type` (required, for example `urn:entity:movie`), optional `signal.interests.entities` (comma separated entity ids), `take` (default 20, max 50). Response `{ success, results: { entities: [...], duration } }` | documented |
| Entity fields | The public spec leaves the entity fields untyped. The client reads `entity_id`, `name`, `types`, `properties.description`, `tags[].name`, `query.affinity`, `popularity` and ignores everything else. An entity without an id or name is dropped | **assumed, confirm with the probe** |
| Base URL | The onboarding page shows `https://staging.api.qloo.com/v2` in its examples, the Insights reference shows `https://api.qloo.com/v2/insights`. The client defaults to `https://api.qloo.com` and `QLOO_BASE_URL` overrides it | **confirm which host the hackathon key is issued for** |
| Rate limits | Not stated. A 429 returns `{ code, reason, message }`. The client retries 429 and 5xx twice with backoff | not documented |

Not used because the docs reviewed do not describe them: tag signals, location filters, demographics, explainability. They can be added once confirmed.

## Nebius Token Factory

Source: docs.tokenfactory.nebius.com (quickstart, API reference index).

| Item | From the docs | Status |
|---|---|---|
| Base URL | `https://api.tokenfactory.nebius.com/v1/` | documented |
| Auth | `Authorization: Bearer $NEBIUS_API_KEY` | documented |
| Chat | `POST /chat/completions`, OpenAI compatible. The SDK's `openAiCompatible` sends `response_format: json_object` | compatible per docs, **confirm JSON mode on the chosen model** |
| Model list | `GET /models` ("List models API") | documented, used by `npm run models` |
| Nemotron ids | Nebius lists Nemotron 3 Nano, Super and Ultra. Third-party catalogs show ids like `nvidia/Nemotron-3-Ultra-550b-a55b`, but Nebius's docs do not state them | **not confirmed, so the agent reads `/models` and picks, or you set `NEBIUS_MODEL_FAST` and `NEBIUS_MODEL_REASONING`** |

## Live probe results

(empty until `npm run probe` has run with real keys)
