# live-deploy-demo

The deploy target behind the **"Deploy to production"** widget on
[thiha.cloud](https://thiha.cloud). Hosted on **GitHub Pages**.

When a visitor edits a message and hits Deploy, the portfolio's AWS Lambda proxy
fires a **real `workflow_dispatch`** here (`.github/workflows/deploy.yml`). The
Action runs `render.mjs` (writes the sanitized message into `data.json`) and
publishes to GitHub Pages — the visitor watches the actual run, then sees their
change live. Input rides in as a workflow input; it is never committed to git.

- Live: https://techthiha.github.io/live-deploy-demo/
- Preview (no deploy): https://techthiha.github.io/live-deploy-demo/?msg=hello&by=you

The page renders `data.json` (or a `?msg=` preview) as **text** — never
`innerHTML` — so nothing typed can inject markup.

Proxy + token setup: see `lambda/deploy-trigger/README.md` in the portfolio repo.
