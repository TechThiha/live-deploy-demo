// POST /deploy — sanitise the visitor's message and write it to KV (instant).
// No token, no build. Origin-locked + rate-limited. Bind KV as MESSAGES.

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

function cors(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

export function onRequestOptions({ request }) {
  return new Response(null, { headers: cors(request.headers.get('Origin') || '') })
}

export async function onRequestPost({ request, env }) {
  const origin = request.headers.get('Origin') || ''
  // Origin lock is the real control (CORS is browser-only).
  if (!ALLOWED_ORIGINS.includes(origin))
    return json({ error: 'forbidden origin' }, 403, origin)

  // Per-IP cooldown (~15s) via KV.
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
