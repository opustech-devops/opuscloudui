/**
 * diagnose.mjs — Diagnóstico direto da API CloudStack
 * Uso: node diagnose.mjs [usuario] [senha] [dominio]
 *
 * Testa:
 *   1. Conectividade SSL com opus1.cloud
 *   2. Login via username+password (MD5)
 *   3. Login via API Key (HMAC-SHA1)
 *   4. Mostra request e response completos
 */

import https from 'https'
import crypto from 'crypto'
import { URLSearchParams } from 'url'

const HOST    = 'opus1.cloud'
// Set CS_API_KEY and CS_SECRET env vars before running:
//   CS_API_KEY=your_key CS_SECRET=your_secret node diagnose.mjs
const API_KEY = process.env.CS_API_KEY || ''
const SECRET  = process.env.CS_SECRET  || ''

if (!API_KEY || !SECRET) {
  console.error('\x1b[31mERRO: defina CS_API_KEY e CS_SECRET como variáveis de ambiente.\x1b[0m')
  process.exit(1)
}

const [,, USER = '', PASS = '', DOMAIN = '/'] = process.argv

// ── Utils ────────────────────────────────────────────────────

const RESET  = '\x1b[0m'
const CYAN   = '\x1b[36m'
const GREEN  = '\x1b[32m'
const YELLOW = '\x1b[33m'
const RED    = '\x1b[31m'
const BOLD   = '\x1b[1m'
const DIM    = '\x1b[2m'

function log(color, label, ...args) {
  console.log(`${color}${BOLD}[${label}]${RESET}`, ...args)
}

function section(title) {
  console.log(`\n${BOLD}${'─'.repeat(60)}${RESET}`)
  console.log(`${BOLD}${CYAN} ${title}${RESET}`)
  console.log(`${BOLD}${'─'.repeat(60)}${RESET}`)
}

function prettyJson(raw) {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return raw
  }
}

// ── HMAC-SHA1 signing ─────────────────────────────────────────
// CloudStack spec: lowercase BOTH key names AND values before signing

function sign(params, secretKey, { lowerValues = true } = {}) {
  const queryString = Object.entries(params)
    .sort(([a], [b]) => a.toLowerCase().localeCompare(b.toLowerCase()))
    .map(([k, v]) => {
      const val = lowerValues ? v.toLowerCase() : v
      return `${k.toLowerCase()}=${encodeURIComponent(val)}`
    })
    .join('&')

  log(DIM, 'SIGN', `String to sign (lowerValues=${lowerValues}):`, queryString)

  const hmac = crypto.createHmac('sha1', secretKey)
  hmac.update(queryString)
  return encodeURIComponent(hmac.digest('base64'))
}

// ── HTTP request helper ───────────────────────────────────────

function request({ method = 'GET', path, body, headers = {} }) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname:           HOST,
      port:               443,
      path,
      method,
      rejectUnauthorized: false,   // permite cert auto-assinado
      headers: {
        'Origin':     `https://${HOST}`,
        'Referer':    `https://${HOST}/client/`,
        'User-Agent': 'Mozilla/5.0 OpusCloud-Diagnose/1.0',
        ...headers,
        ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {}),
      },
    }

    log(CYAN, 'REQUEST', `${method} https://${HOST}${path}`)
    if (body) log(DIM, 'BODY', body)
    Object.entries(options.headers).forEach(([k, v]) => log(DIM, 'HDR ↑', `${k}: ${v}`))

    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => {
        log(res.statusCode < 400 ? GREEN : RED, 'STATUS', res.statusCode, res.statusMessage ?? '')
        Object.entries(res.headers).forEach(([k, v]) => log(DIM, 'HDR ↓', `${k}: ${v}`))
        log(YELLOW, 'BODY', '\n' + prettyJson(data))
        resolve({ status: res.statusCode, headers: res.headers, body: data })
      })
    })

    req.on('error', reject)
    if (body) req.write(body)
    req.end()
  })
}

// ── Tests ─────────────────────────────────────────────────────

async function testSSL() {
  section('1. Teste de Conectividade SSL com opus1.cloud')
  await request({ path: '/client/api?command=listCapabilities&response=json' })
}

async function testApiKeyAuth() {
  section('2a. API Key — assinatura com valores em lowercase (spec oficial)')
  const params = { command: 'listCapabilities', response: 'json', apiKey: API_KEY }
  const sigLow = sign(params, SECRET, { lowerValues: true })
  const qs     = Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
  await request({ path: `/client/api?${qs}&signature=${sigLow}` })

  section('2b. API Key — assinatura sem lowercase nos valores (implementação anterior)')
  const sigOrig = sign(params, SECRET, { lowerValues: false })
  await request({ path: `/client/api?${qs}&signature=${sigOrig}` })
}

async function testLoginPassword() {
  section(`3. Login via Username+Password — usuario: "${USER}" dominio: "${DOMAIN}"`)

  if (!USER || !PASS) {
    log(YELLOW, 'SKIP', 'Passe usuario e senha: node diagnose.mjs <user> <pass> [dominio]')
    return
  }

  const md5pass = crypto.createHash('md5').update(PASS).digest('hex')
  log(DIM, 'MD5', `password MD5: ${md5pass}`)

  // POST com form-encoded (como o app faz)
  const body = new URLSearchParams({
    command: 'login', username: USER, password: md5pass, domain: DOMAIN, response: 'json',
  }).toString()

  await request({
    method:  'POST',
    path:    '/client/api',
    body,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })
}

async function testLoginGet() {
  section(`4. Login via GET (alternativa) — usuario: "${USER}"`)

  if (!USER || !PASS) {
    log(YELLOW, 'SKIP', 'Passe usuario e senha: node diagnose.mjs <user> <pass> [dominio]')
    return
  }

  const md5pass = crypto.createHash('md5').update(PASS).digest('hex')
  const qs = new URLSearchParams({
    command: 'login', username: USER, password: md5pass, domain: DOMAIN, response: 'json',
  }).toString()

  await request({ path: `/client/api?${qs}` })
}

// ── Main ──────────────────────────────────────────────────────

console.log(`\n${BOLD}${CYAN}╔══════════════════════════════════════════════════════════╗`)
console.log(`║   OpusCloud — Diagnóstico de API CloudStack              ║`)
console.log(`╚══════════════════════════════════════════════════════════╝${RESET}`)

try {
  await testSSL()
  await testApiKeyAuth()
  await testLoginPassword()
  await testLoginGet()
} catch (err) {
  log(RED, 'FATAL', err.message)
  process.exit(1)
}
