# try.thiha.cloud — Cloudflare Pages

Serves `try.thiha.cloud` as a **Cloudflare Pages** site: a static page plus two
Pages Functions backed by KV. The "Deploy to production" widget on thiha.cloud
POSTs a message to `/deploy`; we write one KV key and it's live in **under a
second** — no build, no queue, no token anywhere.

## Layout

```
public/index.html     static page — fetches /data (or ?msg= preview), renders as TEXT
functions/deploy.js   POST /deploy → sanitise + write KV   (origin-locked, rate-limited)
functions/data.js     GET  /data   → read KV
wrangler.toml         Pages config + KV binding (for local dev / wrangler deploy)
```

## Deploy via Cloudflare Pages (Connect to Git)

1. **Create the KV namespace** (once):
   ```bash
   npm install
   npx wrangler login
   npx wrangler kv namespace create MESSAGES     # copy the printed id
   ```
   Paste the id into `wrangler.toml` → `[[kv_namespaces]].id`, then commit + push.

2. **Delete the old `try` CNAME** (→ `techthiha.github.io`) in Cloudflare DNS.

3. **Connect the repo:** Cloudflare → Workers & Pages → **Create → Pages → Connect
   to Git** → `TechThiha/try-thiha-cloud`. Build settings:
   - Build command: *(empty)*
   - **Build output directory: `public`**

4. **Bind KV to the Pages project:** project **Settings → Functions → KV namespace
   bindings → Add** → variable name `MESSAGES` → select your `MESSAGES` namespace.
   (Functions read it as `env.MESSAGES`.)

5. **Custom domain:** project **Custom domains → Set up a custom domain →
   `try.thiha.cloud`**.

Every push to `main` now redeploys automatically — pull & watch.

Verify:

```bash
curl -s https://try.thiha.cloud/data           # {"message":"Nothing deployed yet.",...}
curl -s "https://try.thiha.cloud/?msg=hello"    # static page renders "hello"
```

## Point the portfolio at it

Set the env var and redeploy the site:

```
NUXT_PUBLIC_DEPLOY_TRIGGER_URL=https://try.thiha.cloud/deploy
```

The Deploy widget switches from **preview** to **live**: edits hit `/deploy`,
land in KV, and show back instantly in the embedded frame.

## Security

- **No secrets** anywhere — the Functions only read/write a KV string.
- **Origin lock:** `/deploy` returns 403 unless the request is from `thiha.cloud`
  (or localhost in dev). CORS is set too, but the origin check is the real gate.
- **Rate limit:** ~1 write / 15s per IP (KV cooldown) → 429 otherwise.
- **Sanitised:** message clamped to 280 chars / name to 40, control chars stripped.
- **XSS-safe output:** the page renders values via `textContent`, never `innerHTML`.
- **noindex** so visitor text never lands in search results.

## Local dev

```bash
npm run dev     # wrangler pages dev — serves public/ + functions/ with KV
# then in the portfolio:  NUXT_PUBLIC_DEPLOY_TRIGGER_URL=http://localhost:8788/deploy
```
