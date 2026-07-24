# n8n-nodes-wellmarked

[![npm](https://img.shields.io/npm/v/n8n-nodes-wellmarked.svg)](https://www.npmjs.com/package/n8n-nodes-wellmarked)

Official **n8n community node** for the [WellMarked](https://wellmarked.io) API — extract clean Markdown from any URL, crawl whole sites, run bulk jobs, and search the web from inside an n8n workflow.

## Install

In your n8n instance:

1. **Settings → Community Nodes → Install**
2. Enter `n8n-nodes-wellmarked` and click Install.
3. Restart n8n if your install requires it.

Or for self-hosted n8n via the CLI:

```bash
npm install n8n-nodes-wellmarked
```

Requires n8n 1.0+ and Node.js 20.15+.

## Credentials

Create a **WellMarked API** credential with your `wm_...` key. Get one at [wellmarked.io](https://wellmarked.io). The credential test calls `GET /usage`, which validates the key without consuming any quota.

| Field      | Description                                                                  |
|------------|------------------------------------------------------------------------------|
| API Key    | Your WellMarked API key (`wm_...`). Stored encrypted by n8n.                 |

## Operations

The node uses the standard n8n **Resource + Operation** model.

**Output Format** and **Compliance Overrides** (Allow Domains / Deny Patterns / Respect Robots) are available on the Extract, Bulk, Crawl, and Search operations. **Output Format** is one of `markdown` (default), `json`, `chunks`, `html`, or `links` — `json` and `chunks` require Pro+. A **Retry** count (extra re-attempts on target timeouts) is available on Extract, Bulk, and Crawl.

### Extract

- **Extract URL** — `POST /extract`. One URL in, one Markdown result out per input item.
  - Fields: `URL`, `Render JavaScript` (Pro+), `Output Format`, `Retry`, `Compliance Overrides`.

### Bulk Job

For batches of URLs (Free: up to 5 per job; Pro: up to 50; Growth: up to 200; Enterprise: unlimited).

- **Submit** — `POST /bulk`. Returns the job envelope (`job_id`, `status: "queued"`, etc.) and continues immediately. Use this when you want to poll later or run other steps in parallel.
- **Get Status** — `GET /bulk/{job_id}` (polymorphic — also works on crawl job IDs).
- **Submit and Wait** — submits, then polls every N seconds until done, then **fans the results out as one n8n item per URL** so downstream nodes process each extraction individually.
  - Fields: `URLs`, `Render JavaScript` (Pro+), `Output Format`, `Retry`, `Compliance Overrides`.

### Crawl Job

Same three operations against `POST /crawl` / `GET /crawl/{job_id}`. Plan caps: Pro is depth ≤ 5 and ≤ 2,000 pages; Growth is depth ≤ 10 and ≤ 10,000 pages; Enterprise is unlimited. Pages are processed concurrently by the API's worker pool.

- Fields: `Root URL`, `Depth`, `Render JavaScript` (Pro+), `Output Format`, `Retry`, `Max Pages`, `Compliance Overrides`. `Max Pages` caps how many pages the crawl bills — it can only narrow your plan's page cap.
- **Submit and Wait** fans results out as one item per page.
- The output items include `depth` (BFS distance from the root) and the `truncated` / `truncated_reason` fields when the crawl stopped early.

### Search

- **Search** — `POST /search`. Search the web and extract every result to Markdown in one synchronous call; fans the results out as one n8n item per page. Requires Pro+. Costs `1 + Number of Results` requests.
  - Fields: `Query`, `Number of Results` (1–10, default 5), `Render JavaScript` (Pro+), `Output Format`, `Compliance Overrides`.

### Account

- **Get Usage** — `GET /usage`. Returns plan, period, used / limit / remaining. Free; does not count against quota.

## Long-running jobs

`Submit and Wait` blocks the n8n execution while polling. n8n workflows typically have a workflow timeout (default 30 min self-hosted, less on n8n Cloud); if your bulk batch or crawl might run longer than that, use **Submit** + a separate **Get Status** call in a follow-up step or scheduled workflow.

The default poll interval is 2 s and the default wait timeout is 300 s — both configurable on the node.

## Webhooks (alternative to polling)

The WellMarked API supports outbound webhooks: pass a `webhook_url` on `POST /bulk` or `POST /crawl` and we POST a signed `job.completed` notification to your URL when the job finishes — no polling needed.

This node does **not yet** expose a `Webhook URL` field on the Submit operations — open an issue if you want it. In the meantime, a workflow that combines an **n8n Webhook trigger** with an **HTTP Request** node to `POST /bulk` (or `/crawl`) achieves the same:

1. Add an **n8n Webhook** trigger node — n8n gives you a public URL.
2. **HTTP Request** node → `POST https://api.wellmarked.io/bulk` with body `{ "urls": [...], "webhook_url": "<the n8n webhook URL>" }` and your `Authorization: Bearer wm_...` header.
3. The first response carries `webhook_signing_secret` (shown once — store it as an n8n credential or env var).
4. In the webhook trigger's downstream flow, verify `X-WellMarked-Signature` against your stored secret before acting on the payload.

See the [WellMarked Webhooks docs](https://wellmarked.io/docs#webhooks) for the signature scheme, retry policy, and payload shape.

## Errors

The node surfaces every WellMarked error code (`rate_limit_too_fast`, `rate_limit_exceeded`, `target_timeout`, `plan_not_supported`, etc.) as an n8n **NodeApiError** with the original message and HTTP status. Toggle **Continue On Fail** on the node if you want per-URL failures to emit `{ error: "..." }` items instead of stopping the workflow.

The per-second rate limit (Free 5/s · Pro 20/s · Growth 100/s · Enterprise unlimited) surfaces as `rate_limit_too_fast` 429s. If you're polling status with tight intervals, set the **Poll Interval** above your tier's spacing (200 ms for Free, 50 ms for Pro, 10 ms for Growth) to avoid spurious rejections.

## Development

```bash
git clone https://github.com/WellMarkedAPI/n8n.git
cd n8n
npm install
npm run build         # compiles to dist/ and copies icons
npm link              # makes the package globally linkable

# In your n8n install dir:
cd ~/.n8n/custom
npm link n8n-nodes-wellmarked
# Restart n8n; the WellMarked node appears in the palette.
```

## License

Copyright © 2026 WellMarked. Released under the [MIT License](LICENSE).

Source: <https://github.com/WellMarkedAPI/n8n>

Use of the hosted API at `api.wellmarked.io` remains subject to the
[Terms of Service](https://wellmarked.io/terms).
