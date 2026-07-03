/**
 * try.thiha.cloud — served from the edge (Cloudflare Worker + KV).
 *
 * A visitor on thiha.cloud edits a message and hits Deploy. The portfolio POSTs
 * to /deploy → we write one KV key → the change is live in <1s. No build, no
 * queue, no token anywhere. GET / renders the current message (HTML-escaped, so
 * user text can never inject markup).
 *
 * Endpoints:
 *   GET  /            → HTML page with the current message (or ?msg= preview)
 *   GET  /data        → JSON of the current message
 *   POST /deploy      → { message, by } → sanitise + write KV (origin-locked, rate-limited)
 */

const MSG_MAX = 280
const NAME_MAX = 40
const ALLOWED_ORIGINS = [
  'https://thiha.cloud',
  'https://www.thiha.cloud',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]

const CONTROL = new RegExp('[\\u0000-\\u001F\\u007F]', 'g')
const clamp = (s, n) => String(s ?? '').replace(CONTROL, '').trim().slice(0, n)

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }
const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ESC[c])

function cors(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  }
}

function json(obj, status, origin, extra = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors(origin), 'Content-Type': 'application/json', ...extra },
  })
}

async function readCurrent(env) {
  const raw = await env.MESSAGES.get('current')
  return raw ? JSON.parse(raw) : { message: 'Nothing deployed yet.', by: 'thiha', at: null }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const origin = request.headers.get('Origin') || ''

    if (request.method === 'OPTIONS')
      return new Response(null, { headers: cors(origin) })

    // ── POST /deploy ──────────────────────────────────────────────────
    if (url.pathname === '/deploy') {
      if (request.method !== 'POST')
        return json({ error: 'method not allowed' }, 405, origin)
      // Origin lock is the real control (CORS is browser-only).
      if (!ALLOWED_ORIGINS.includes(origin))
        return json({ error: 'forbidden origin' }, 403, origin)

      // Per-IP cooldown (KV, ~15s).
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown'
      if (await env.MESSAGES.get(`rl:${ip}`))
        return json({ error: 'slow down' }, 429, origin, { 'Retry-After': '15' })
      await env.MESSAGES.put(`rl:${ip}`, '1', { expirationTtl: 15 })

      const body = await request.json().catch(() => ({}))
      const data = {
        message: clamp(body.message, MSG_MAX) || 'Hello from thiha.cloud 👋',
        by: clamp(body.by, NAME_MAX) || 'a visitor',
        at: new Date().toISOString(),
      }
      await env.MESSAGES.put('current', JSON.stringify(data))
      return json({ ok: true, ...data }, 200, origin)
    }

    // ── GET /data ─────────────────────────────────────────────────────
    if (url.pathname === '/data')
      return json(await readCurrent(env), 200, origin, { 'Cache-Control': 'no-store' })

    // ── GET / (page) ──────────────────────────────────────────────────
    let data
    if (url.searchParams.has('msg')) {
      // Preview: content comes from the query string, nothing is written.
      data = {
        message: clamp(url.searchParams.get('msg'), MSG_MAX),
        by: clamp(url.searchParams.get('by'), NAME_MAX) || 'a visitor',
        at: Date.now(),
      }
    }
    else {
      data = await readCurrent(env)
    }

    return new Response(renderHtml(data), {
      headers: {
        'Content-Type': 'text/html;charset=utf-8',
        'Cache-Control': 'no-store',
        // Only our sites may embed this page.
        'Content-Security-Policy': 'frame-ancestors https://thiha.cloud http://localhost:3000',
      },
    })
  },
}

function renderHtml(data) {
  const message = escapeHtml(data.message || 'Nothing deployed yet.')
  const by = escapeHtml(data.by || 'anonymous')
  let at = 'just now'
  try { at = data.at ? escapeHtml(new Date(data.at).toUTCString()) : 'just now' }
  catch { at = 'just now' }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Deployed from thiha.cloud</title>
<meta name="robots" content="noindex">
<style>
  :root { color-scheme: dark; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { min-height:100vh; display:grid; place-items:center; padding:24px;
    font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace; background:#0b0d0f; color:#e6e8ea; }
  .card { width:100%; max-width:560px; border:1px solid rgba(148,163,184,0.16); border-radius:16px; background:#131619; overflow:hidden; }
  .bar { display:flex; align-items:center; gap:8px; padding:12px 16px; border-bottom:1px solid rgba(148,163,184,0.16); background:rgba(0,0,0,0.2); }
  .dot { width:11px; height:11px; border-radius:50%; }
  .bar span { margin-left:auto; font-size:12px; color:#9aa4af; }
  .body { padding:32px 28px; }
  .badge { display:inline-flex; align-items:center; gap:7px; font-size:12px; color:#34d399;
    border:1px solid rgba(52,211,153,0.3); background:rgba(52,211,153,0.08); padding:4px 10px; border-radius:999px; margin-bottom:18px; }
  .badge i { width:7px; height:7px; border-radius:50%; background:#22c55e; display:inline-block; }
  #message { font-size:clamp(22px,5vw,34px); font-weight:800; line-height:1.25; letter-spacing:-0.01em;
    white-space:pre-wrap; word-break:break-word; font-family:'Space Grotesk', system-ui, sans-serif; }
  .meta { margin-top:20px; font-size:13px; color:#9aa4af; }
  .meta b { color:#cbd5e1; font-weight:600; }
  .foot { padding:14px 16px; border-top:1px solid rgba(148,163,184,0.16); font-size:12px; color:#6b7280; text-align:center; }
  .foot a { color:#34d399; text-decoration:none; }
</style>
</head>
<body>
  <div class="card">
    <div class="bar">
      <span class="dot" style="background:#ec6a5e"></span>
      <span class="dot" style="background:#f4bf4f"></span>
      <span class="dot" style="background:#61c554"></span>
      <span>try.thiha.cloud · edge</span>
    </div>
    <div class="body">
      <div class="badge"><i></i> deployed &amp; live</div>
      <div id="message">${message}</div>
      <div class="meta">shipped by <b>${by}</b> · ${at}</div>
    </div>
    <div class="foot">served from the edge via <a href="https://thiha.cloud" target="_blank" rel="noopener">thiha.cloud</a></div>
  </div>
</body>
</html>`
}
