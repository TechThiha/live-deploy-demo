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
└── data.json           # Fallback (not used by live deploys)
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

---

## License

MIT