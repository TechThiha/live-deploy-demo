# try.thiha.cloud — edge Worker

Serves `try.thiha.cloud` from a Cloudflare Worker backed by KV. The "Deploy to
production" widget on thiha.cloud POSTs a message here; we write one KV key and
it's live in **under a second** — no build, no queue, no token anywhere.

## Deploy (one-time)

```bash
npm install              # gets wrangler locally
npx wrangler login       # opens Cloudflare auth in your browser

# 1) Create the KV namespace and copy the printed id into wrangler.toml
npx wrangler kv namespace create MESSAGES
#    → paste the id into kv_namespaces[0].id in wrangler.toml

# 2) Remove the OLD GitHub-Pages DNS record for `try` in the Cloudflare
#    dashboard (the CNAME → techthiha.github.io). The repo is gone; the Worker
#    replaces it. `custom_domain = true` in wrangler.toml creates the new record.

# 3) Deploy — this also provisions try.thiha.cloud + TLS
npm run deploy
```

## Continuous deploy (pull & watch)

`.github/workflows/deploy.yml` redeploys the Worker on every push to `main`.
Add two repo secrets once — **Settings → Secrets → Actions**:

- `CLOUDFLARE_API_TOKEN` — a token with the *Edit Cloudflare Workers* permission
- `CLOUDFLARE_ACCOUNT_ID` — your Cloudflare account id

After that: anyone edits → pushes → the Action deploys → you just `git pull` and
watch the run. No secrets ever live in the browser or the Worker itself.

Verify:

```bash
curl -s https://try.thiha.cloud/data          # {"message":"Nothing deployed yet.",...}
curl -s "https://try.thiha.cloud/?msg=hello"   # HTML with "hello"
```

## Point the portfolio at it

Set the build/env var and redeploy the site:

```
NUXT_PUBLIC_DEPLOY_TRIGGER_URL=https://try.thiha.cloud/deploy
```

The Deploy widget switches from **preview** to **live**: edits are written to KV
and shown back instantly in the embedded frame.

## What's built in (security)

- **No secrets.** The Worker only reads/writes a KV string — nothing to leak.
- **Origin lock:** `/deploy` returns 403 unless the request comes from
  `thiha.cloud` (or localhost in dev). CORS is set too, but the origin check is
  the real gate.
- **Rate limit:** ~1 write / 15s per IP (KV cooldown) → 429 otherwise.
- **Sanitised + escaped:** message clamped to 280 chars / name to 40, control
  chars stripped, and the page renders text **HTML-escaped** — user input can't
  inject markup or script.
- **Embedding:** `frame-ancestors` restricts who can iframe the page to
  thiha.cloud (+ localhost). The portfolio also sandboxes the iframe.
- **noindex** so visitor text never lands in search results.

## Local dev

Run the Worker locally and point the site's env at it:

```bash
wrangler dev                                   # http://localhost:8787
# then in the portfolio:  NUXT_PUBLIC_DEPLOY_TRIGGER_URL=http://localhost:8787/deploy
```
