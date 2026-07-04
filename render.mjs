// Writes data.json from the workflow inputs, sanitized. Runs inside the Pages
// build — the visitor's text ends up only in the deployed artifact. Input
// arrives via env (never interpolated into the shell), so there's no Actions
// script-injection surface. index.html renders it as text (never innerHTML).
import { writeFileSync } from 'node:fs'

// Built from an escaped string so no raw control bytes live in this file.
const CONTROL = new RegExp('[\\u0000-\\u001F\\u007F]', 'g')
const clamp = (s, max) => String(s ?? '').replace(CONTROL, '').trim().slice(0, max)

const data = {
  message: clamp(process.env.MSG, 280) || 'Hello from thiha.cloud 👋',
  by: clamp(process.env.BY, 40) || 'a visitor',
  at: new Date().toISOString(),
}

writeFileSync('data.json', `${JSON.stringify(data, null, 2)}\n`)
console.log('Published:', data)
