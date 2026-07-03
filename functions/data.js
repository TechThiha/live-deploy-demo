// GET /data — returns the currently deployed message from KV. Bind KV as MESSAGES.

const ALLOWED_ORIGINS = [
  'https://thiha.cloud',
  'https://www.thiha.cloud',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]

function cors(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return { 'Access-Control-Allow-Origin': allow, 'Vary': 'Origin' }
}

export async function onRequestGet({ request, env }) {
  const origin = request.headers.get('Origin') || ''
  const raw = await env.MESSAGES.get('current')
  const data = raw ? JSON.parse(raw) : { message: 'Nothing deployed yet.', by: 'thiha', at: null }
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...cors(origin), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}
