# live-deploy-demo

The "deploy target" behind the **Deploy to production** widget on [thiha.cloud](https://thiha.cloud).

Hosted on **GitHub Pages** at https://techthiha.github.io/live-deploy-demo/

---

## How it works

1. A visitor on thiha.cloud writes a message, hits **Deploy**
2. The portfolio POSTs `{ message, by }` to an **API Gateway** → **Lambda** (AWS)
3. The Lambda fires a `workflow_dispatch` on this repo (uses a fine-grained PAT with Actions R/W only)
4. GitHub Actions runs `render.mjs` → writes `data.json` + `manifest.json` → publishes to Pages
5. The portfolio polls the Actions run, shows live stages, then iframes the deployed page

**Preview mode** (no deploy): append `?msg=hello&by=you` to the Pages URL — renders client-side only, nothing published.

---

## Repo structure

```
├── index.html          # Renders data.json (or ?msg=) as TEXT — no innerHTML, XSS-safe
├── render.mjs          # Build-time script: reads MSG/BY env → writes data.json
├── _site/              # Artifact output (created at build time)
├── .github/workflows/
│   └── deploy.yml      # workflow_dispatch + push → build → upload-pages-artifact → deploy-pages
└── data.json           # Stable-path copy of the latest deploy; index.html
                        # falls back to it when the embedded manifest is stale
```

---

## The workflow

`.github/workflows/deploy.yml` does:

- **checkout** → **configure-pages** → **build** (runs `render.mjs` with `MSG`/`BY` from workflow inputs) → **upload-pages-artifact** (uploads `_site/`) → **deploy-pages**

The `render.mjs` writes a timestamped file (`data-<unix>.json`) + `manifest.json` pointing to it. This cache-busts GitHub Pages' ~600s edge cache.

---

## Local test

```bash
# Preview only (no deploy)
MSG="hello" BY="me" node render.mjs
# opens index.html?msg=hello&by=me in browser
```

---

## Security notes

- `index.html` uses `textContent` only — never `innerHTML`
- Inputs arrive via **env vars** in the Action (never shell-interpolated)
- Lambda holds the PAT server-side; browser never sees it
- Per-IP DynamoDB cooldown (30s) + origin allowlist on the Lambda
- Fine-grained PAT scoped to **Actions: Read & Write** on *this repo only*

### What GitHub Pages cannot do here

Pages serves static files and **sends no custom headers**. A `_headers` file is a
Netlify / Cloudflare Pages convention and is ignored — one used to live here
setting `no-store` on `manifest.json` and `data-*.json`, and it never once took
effect. Verified: the response carries no `Content-Security-Policy`,
`X-Frame-Options` or `Referrer-Policy`.

What that means in practice:

- **Cache control** is done in the client instead — every fetch appends `?t=`,
  and a stale manifest falls back to `data.json`.
- The CSP is delivered via `<meta>`, so directives that only work as a real
  header are inert. `frame-ancestors` is the notable one: it is kept accurate
  (`https://dev.thiha.cloud`) as documentation of intent, and the browser logs
  that it is ignored. `X-Frame-Options` cannot be set at all.
- Treat this page as **publicly framable**. Nothing sensitive belongs on it —
  it renders one short public message, which is the whole design.

Putting the site behind Cloudflare would make `_headers` real and these
directives enforceable.

---

## License

MIT