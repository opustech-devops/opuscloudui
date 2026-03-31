/**
 * CloudStack API Client
 *
 * Auth modes:
 *   1. Session auth  — login(username, password) → sessionkey
 *   2. API key auth  — HMAC-SHA1 signed requests (apiKey + secretKey)
 *
 * In dev: requests are proxied through Vite → https://opus1.cloud/client/api
 */

import CryptoJS from 'crypto-js'
import type {
  LoginResponse,
  CloudStackError,
  CloudStackConfig,
  SessionUser,
  ListVMsResponse,
  ListVolumesResponse,
  ListNetworksResponse,
  ListPublicIPsResponse,
  ListSnapshotsResponse,
} from '../types'

const BASE_URL = '/client/api'

const ROLE_MAP: Record<string, SessionUser['role']> = {
  '0': 'user',
  '1': 'domain-admin',
  '2': 'root-admin',
}

// ── Signature ────────────────────────────────────────────────

function generateSignature(params: Record<string, string>, secretKey: string): string {
  const queryString = Object.entries(params)
    .sort(([a], [b]) => a.toLowerCase().localeCompare(b.toLowerCase()))
    .map(([k, v]) => `${k.toLowerCase()}=${encodeURIComponent(v)}`)
    .join('&')

  const hmac = CryptoJS.HmacSHA1(queryString, secretKey)
  const b64  = CryptoJS.enc.Base64.stringify(hmac)
  return encodeURIComponent(b64)
}

function isErrorResponse(data: unknown): data is CloudStackError {
  return typeof data === 'object' && data !== null && 'errorresponse' in data
}

// ── Session expired check ────────────────────────────────────

function isSessionExpired(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  const msg = err.message.toLowerCase()
  return (
    msg.includes('unable to verify user') ||
    msg.includes('session has expired') ||
    msg.includes('unauthorized') ||
    msg.includes('unauthenticated')
  )
}

// ── Client ───────────────────────────────────────────────────

export class CloudStackClient {
  private config: CloudStackConfig
  /** Called when session expires so the app can redirect to login */
  onSessionExpired?: () => void

  constructor(config: Partial<CloudStackConfig> = {}) {
    this.config = { baseUrl: BASE_URL, ...config }
  }

  // ── Auth ────────────────────────────────────────────────────

  setSessionKey(sessionKey: string) {
    this.config.sessionKey = sessionKey
  }

  setApiCredentials(apiKey: string, secretKey: string) {
    this.config.apiKey    = apiKey
    this.config.secretKey = secretKey
  }

  clearSession() {
    this.config.sessionKey = undefined
  }

  get hasSession() { return Boolean(this.config.sessionKey) }
  get hasApiKey()  { return Boolean(this.config.apiKey && this.config.secretKey) }

  // ── Login ────────────────────────────────────────────────────

  async login(username: string, password: string, domain = '/'): Promise<SessionUser> {
    const hashedPassword = CryptoJS.MD5(password).toString()

    const body = new URLSearchParams({
      command:  'login',
      username,
      password: hashedPassword,
      domain,
      response: 'json',
    })

    const res = await fetch(this.config.baseUrl, {
      method:      'POST',
      headers:     { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:        body.toString(),
      credentials: 'include',
    })

    // Sempre lê o body antes de checar status —
    // CloudStack pode retornar HTTP 4xx/5xx com JSON de erro detalhado
    let data: unknown
    try {
      data = await res.json()
    } catch {
      // Body não é JSON (ex: HTML de erro do proxy/WAF)
      throw new Error(
        `Erro ${res.status} ao conectar com o servidor. Verifique se o serviço está acessível.`,
      )
    }

    // Erro com detalhes do CloudStack (pode vir em qualquer status HTTP)
    if (isErrorResponse(data)) {
      throw new Error(data.errorresponse.errortext || `Erro de autenticação (${res.status})`)
    }

    if (!res.ok) {
      throw new Error(`Erro HTTP ${res.status}: resposta inesperada do servidor`)
    }

    const lr = (data as LoginResponse).loginresponse
    if (!lr?.sessionkey) {
      throw new Error('Resposta inválida: sessionkey não encontrada')
    }

    this.config.sessionKey = lr.sessionkey

    return {
      username:   lr.username,
      userid:     lr.userid,
      account:    lr.account,
      domainid:   lr.domainid,
      domain:     lr.domain ?? domain,
      sessionKey: lr.sessionkey,
      role:       ROLE_MAP[lr.type] ?? 'user',
    }
  }

  // ── Generic request ──────────────────────────────────────────

  async request<T = unknown>(
    command: string,
    params:  Record<string, string> = {},
  ): Promise<T> {
    const allParams: Record<string, string> = { command, response: 'json', ...params }

    let url: string

    if (this.config.apiKey && this.config.secretKey) {
      allParams.apiKey = this.config.apiKey
      const signature  = generateSignature(allParams, this.config.secretKey)
      const qs = Object.entries(allParams).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
      url = `${this.config.baseUrl}?${qs}&signature=${signature}`
    } else if (this.config.sessionKey) {
      allParams.sessionkey = this.config.sessionKey
      const qs = Object.entries(allParams).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
      url = `${this.config.baseUrl}?${qs}`
    } else {
      throw new Error('Nenhuma credencial disponível. Faça login primeiro.')
    }

    const res = await fetch(url, { credentials: 'include' })

    if (!res.ok) throw new Error(`Erro HTTP ${res.status}: ${res.statusText}`)

    const data: unknown = await res.json()

    if (isErrorResponse(data)) {
      const err = new Error(data.errorresponse.errortext)
      if (isSessionExpired(err)) this.onSessionExpired?.()
      throw err
    }

    return data as T
  }

  // ── Resource list helpers ────────────────────────────────────

  async listVirtualMachines(params: Record<string, string> = {}) {
    const res = await this.request<ListVMsResponse>('listVirtualMachines', {
      pagesize: '500',
      ...params,
    })
    const r = res.listvirtualmachinesresponse
    return { count: r.count ?? 0, items: r.virtualmachine ?? [] }
  }

  async listVolumes(params: Record<string, string> = {}) {
    const res = await this.request<ListVolumesResponse>('listVolumes', {
      pagesize: '500',
      ...params,
    })
    const r = res.listvolumesresponse
    return { count: r.count ?? 0, items: r.volume ?? [] }
  }

  async listNetworks(params: Record<string, string> = {}) {
    const res = await this.request<ListNetworksResponse>('listNetworks', {
      pagesize: '500',
      ...params,
    })
    const r = res.listnetworksresponse
    return { count: r.count ?? 0, items: r.network ?? [] }
  }

  async listPublicIpAddresses(params: Record<string, string> = {}) {
    const res = await this.request<ListPublicIPsResponse>('listPublicIpAddresses', {
      pagesize: '500',
      ...params,
    })
    const r = res.listpublicipaddressesresponse
    return { count: r.count ?? 0, items: r.publicipaddress ?? [] }
  }

  async listSnapshots(params: Record<string, string> = {}) {
    const res = await this.request<ListSnapshotsResponse>('listSnapshots', {
      pagesize: '500',
      ...params,
    })
    const r = res.listsnapshotsresponse
    return { count: r.count ?? 0, items: r.snapshot ?? [] }
  }

  async listApis() {
    return this.request<unknown>('listApis')
  }
}

// ── Singleton (API key for OPUSTECH domain) ──────────────────
export const cloudstack = new CloudStackClient({
  apiKey:    '***REMOVED_API_KEY***',
  secretKey: '***REMOVED_SECRET_KEY***',
})
