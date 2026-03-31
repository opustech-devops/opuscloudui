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
  TwoFactorPending,
  CloudStackError,
  CloudStackConfig,
  SessionUser,
  ListEventsResponse,
  ListKubernetesClustersResponse,
  ListResourceLimitsResponse,
  ListTemplatesResponse,
  ListVMsResponse,
  ListVpcsResponse,
  ListVolumesResponse,
  ListNetworksResponse,
  ListPublicIPsResponse,
  ListSnapshotsResponse,
  ListCapacityResponse,
  ListAlertsResponse,
  ListZonesResponse,
  ListPodsResponse,
  ListClustersResponse,
  ListHostsResponse,
  ListStoragePoolsResponse,
  ListSystemVmsResponse,
  ListRoutersResponse,
  ListAccountsResponse,
  ListDomainsResponse,
  ListUsersResponse,
  ListServiceOfferingsResponse,
  ListDiskOfferingsResponse,
  ListNetworkOfferingsResponse,
  ListSSHKeyPairsResponse,
  ListSecurityGroupsResponse,
  ListISOsResponse,
  ListRolesResponse,
  ListProjectsResponse,
  AsyncJobResponse,
} from '../types'

const BASE_URL = '/client/api'

const ROLE_MAP: Record<string, SessionUser['role']> = {
  '0': 'user',
  '1': 'domain-admin',
  '2': 'root-admin',
}

// ── Signature ────────────────────────────────────────────────

function generateSignature(params: Record<string, string>, secretKey: string): string {
  // CloudStack spec: lowercase key names, preserve value case, sort alphabetically
  // Ref: https://docs.cloudstack.apache.org/en/latest/developersguide/dev.html
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

  async login(
    username: string,
    password: string,
    domain = '/',
  ): Promise<SessionUser | TwoFactorPending> {
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

    // Sempre lê o body antes de checar status
    let data: unknown
    try {
      data = await res.json()
    } catch {
      throw new Error(
        `Erro ${res.status} ao conectar com o servidor. Verifique se o serviço está acessível.`,
      )
    }

    if (isErrorResponse(data)) {
      throw new Error(data.errorresponse.errortext || `Erro de autenticação (${res.status})`)
    }

    const lr = (data as LoginResponse).loginresponse

    // CloudStack 4.18+: login com 2FA obrigatório retorna sessionkey parcial +
    // is2FAenabled="true" e is2FAverified="false". A sessionkey só funciona
    // plenamente após validateUserTwoFactorAuthenticationCode.
    if (lr?.is2FAenabled === 'true' && lr?.is2FAverified !== 'true') {
      if (!lr.sessionkey) {
        throw new Error('Autenticação 2FA necessária mas sessionkey não foi retornada.')
      }
      // Guarda a sessionkey parcial para uso no verify2FA
      this.config.sessionKey = lr.sessionkey
      return {
        requires2FA: true,
        userid:      lr.userid,
        username:    lr.username,
        sessionKey:  lr.sessionkey,
      } satisfies TwoFactorPending
    }

    if (lr?.errorcode) {
      throw new Error(lr.errortext || `Erro de autenticação (${lr.errorcode})`)
    }

    if (!res.ok) {
      throw new Error(`Erro HTTP ${res.status}: resposta inesperada do servidor`)
    }

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

  // ── 2FA Verification ─────────────────────────────────────────

  async verify2FA(code: string): Promise<SessionUser> {
    if (!this.config.sessionKey) {
      throw new Error('Sessão não iniciada. Faça login primeiro.')
    }

    const url = `${this.config.baseUrl}?command=validateUserTwoFactorAuthenticationCode` +
      `&codefor2fa=${encodeURIComponent(code)}` +
      `&sessionkey=${encodeURIComponent(this.config.sessionKey)}` +
      `&response=json`

    const res = await fetch(url, { credentials: 'include' })

    let data: unknown
    try {
      data = await res.json()
    } catch {
      throw new Error(
        `Erro ${res.status} ao verificar código 2FA.`,
      )
    }

    if (isErrorResponse(data)) {
      throw new Error(data.errorresponse.errortext || 'Código 2FA inválido.')
    }

    // Após verificação bem-sucedida, busca dados completos do usuário
    const sessionKey = this.config.sessionKey
    const meRes = await fetch(
      `${this.config.baseUrl}?command=listUsers&sessionkey=${encodeURIComponent(sessionKey)}&response=json`,
      { credentials: 'include' },
    )
    const meData = await meRes.json() as {
      listusersresponse?: { user?: Array<{
        username: string; id: string; account: string
        domainid: string; domain: string; usersource: string
      }> }
    }
    const user = meData.listusersresponse?.user?.[0]

    if (!user) {
      // Se listUsers falhar, retorna dados mínimos com a sessionkey
      throw new Error('2FA verificado mas não foi possível obter dados do usuário.')
    }

    return {
      username:   user.username,
      userid:     user.id,
      account:    user.account,
      domainid:   user.domainid,
      domain:     user.domain,
      sessionKey,
      role:       'user',
    }
  }

  // ── Generic request ──────────────────────────────────────────

  async request<T = unknown>(
    command: string,
    params:  Record<string, string> = {},
  ): Promise<T> {
    const allParams: Record<string, string> = { command, response: 'json', ...params }

    let url: string

    // Session key takes priority over API key: after login the session is fresh
    // and scoped to the logged-in user. API key is the fallback for unauthenticated flows.
    if (this.config.sessionKey) {
      allParams.sessionkey = this.config.sessionKey
      const qs = Object.entries(allParams).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
      url = `${this.config.baseUrl}?${qs}`
    } else if (this.config.apiKey && this.config.secretKey) {
      allParams.apiKey = this.config.apiKey
      const signature  = generateSignature(allParams, this.config.secretKey)
      const qs = Object.entries(allParams).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
      url = `${this.config.baseUrl}?${qs}&signature=${signature}`
    } else {
      throw new Error('Nenhuma credencial disponível. Faça login primeiro.')
    }

    const res = await fetch(url, { credentials: 'include' })

    // Always read the body first — CloudStack puts the real error text in JSON
    // even for non-2xx status codes (e.g. 431, 401, 432).
    let data: unknown
    try {
      data = await res.json()
    } catch {
      throw new Error(`Erro HTTP ${res.status}: ${res.statusText || 'resposta sem corpo'}`)
    }

    if (isErrorResponse(data)) {
      const err = new Error(data.errorresponse.errortext)
      if (isSessionExpired(err)) this.onSessionExpired?.()
      throw err
    }

    if (!res.ok) {
      throw new Error(`Erro HTTP ${res.status}: ${res.statusText || 'resposta inesperada do servidor'}`)
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

  async listResourceLimits(params: Record<string, string> = {}) {
    const res = await this.request<ListResourceLimitsResponse>('listResourceLimits', params)
    const r = res.listresourcelimitsresponse
    return { count: r.count ?? 0, items: r.resourcelimit ?? [] }
  }

  async listEvents(params: Record<string, string> = {}) {
    const res = await this.request<ListEventsResponse>('listEvents', {
      pagesize: '10',
      ...params,
    })
    const r = res.listeventsresponse
    return { count: r.count ?? 0, items: r.event ?? [] }
  }

  async listVpcs(params: Record<string, string> = {}) {
    const res = await this.request<ListVpcsResponse>('listVPCs', {
      pagesize: '500',
      ...params,
    })
    const r = res.listvpcsresponse
    return { count: r.count ?? 0, items: r.vpc ?? [] }
  }

  async listTemplates(params: Record<string, string> = {}) {
    const res = await this.request<ListTemplatesResponse>('listTemplates', {
      pagesize: '500',
      templatefilter: 'selfexecutable',
      ...params,
    })
    const r = res.listtemplatesresponse
    return { count: r.count ?? 0, items: r.template ?? [] }
  }

  async listKubernetesClusters(params: Record<string, string> = {}) {
    const res = await this.request<ListKubernetesClustersResponse>('listKubernetesClusters', {
      pagesize: '500',
      ...params,
    })
    const r = res.listkubernetesclustersresponse
    return { count: r.count ?? 0, items: r.kubernetescluster ?? [] }
  }

  async listApis() {
    return this.request<unknown>('listApis')
  }

  // ── Infrastructure ───────────────────────────────────────

  async listCapacity(params: Record<string, string> = {}) {
    const res = await this.request<ListCapacityResponse>('listCapacity', params)
    return { count: res.listcapacityresponse.count ?? 0, items: res.listcapacityresponse.capacity ?? [] }
  }

  async listAlerts(params: Record<string, string> = {}) {
    const res = await this.request<ListAlertsResponse>('listAlerts', { pagesize: '20', ...params })
    return { count: res.listalertsresponse.count ?? 0, items: res.listalertsresponse.alert ?? [] }
  }

  async listZones(params: Record<string, string> = {}) {
    const res = await this.request<ListZonesResponse>('listZones', { available: 'true', ...params })
    return { count: res.listzonesresponse.count ?? 0, items: res.listzonesresponse.zone ?? [] }
  }

  async listPods(params: Record<string, string> = {}) {
    const res = await this.request<ListPodsResponse>('listPods', { pagesize: '500', ...params })
    return { count: res.listpodsresponse.count ?? 0, items: res.listpodsresponse.pod ?? [] }
  }

  async listClusters(params: Record<string, string> = {}) {
    const res = await this.request<ListClustersResponse>('listClusters', { pagesize: '500', ...params })
    return { count: res.listclustersresponse.count ?? 0, items: res.listclustersresponse.cluster ?? [] }
  }

  async listHosts(params: Record<string, string> = {}) {
    const res = await this.request<ListHostsResponse>('listHosts', { pagesize: '500', type: 'Routing', ...params })
    return { count: res.listhostsresponse.count ?? 0, items: res.listhostsresponse.host ?? [] }
  }

  async listStoragePools(params: Record<string, string> = {}) {
    const res = await this.request<ListStoragePoolsResponse>('listStoragePools', { pagesize: '500', ...params })
    return { count: res.liststoragepoolsresponse.count ?? 0, items: res.liststoragepoolsresponse.storagepool ?? [] }
  }

  async listSystemVms(params: Record<string, string> = {}) {
    const res = await this.request<ListSystemVmsResponse>('listSystemVms', { pagesize: '500', ...params })
    return { count: res.listsystemvmsresponse.count ?? 0, items: res.listsystemvmsresponse.systemvm ?? [] }
  }

  async listRouters(params: Record<string, string> = {}) {
    const res = await this.request<ListRoutersResponse>('listRouters', { pagesize: '500', listall: 'true', ...params })
    return { count: res.listroutersresponse.count ?? 0, items: res.listroutersresponse.router ?? [] }
  }

  // ── Accounts / Domains / Users ───────────────────────────

  async listAccounts(params: Record<string, string> = {}) {
    const res = await this.request<ListAccountsResponse>('listAccounts', { pagesize: '500', listall: 'true', ...params })
    return { count: res.listaccountsresponse.count ?? 0, items: res.listaccountsresponse.account ?? [] }
  }

  async listDomains(params: Record<string, string> = {}) {
    const res = await this.request<ListDomainsResponse>('listDomains', { pagesize: '500', listall: 'true', ...params })
    return { count: res.listdomainsresponse.count ?? 0, items: res.listdomainsresponse.domain ?? [] }
  }

  async listUsers(params: Record<string, string> = {}) {
    const res = await this.request<ListUsersResponse>('listUsers', { pagesize: '500', listall: 'true', ...params })
    return { count: res.listusersresponse.count ?? 0, items: res.listusersresponse.user ?? [] }
  }

  // ── Offerings ────────────────────────────────────────────

  async listServiceOfferings(params: Record<string, string> = {}) {
    const res = await this.request<ListServiceOfferingsResponse>('listServiceOfferings', { pagesize: '500', ...params })
    return { count: res.listserviceofferingsresponse.count ?? 0, items: res.listserviceofferingsresponse.serviceoffering ?? [] }
  }

  async listDiskOfferings(params: Record<string, string> = {}) {
    const res = await this.request<ListDiskOfferingsResponse>('listDiskOfferings', { pagesize: '500', ...params })
    return { count: res.listdiskofferingsresponse.count ?? 0, items: res.listdiskofferingsresponse.diskoffering ?? [] }
  }

  async listNetworkOfferings(params: Record<string, string> = {}) {
    const res = await this.request<ListNetworkOfferingsResponse>('listNetworkOfferings', { pagesize: '500', ...params })
    return { count: res.listnetworkofferingsresponse.count ?? 0, items: res.listnetworkofferingsresponse.networkoffering ?? [] }
  }

  // ── Images / Keys / Security ─────────────────────────────

  async listSSHKeyPairs(params: Record<string, string> = {}) {
    const res = await this.request<ListSSHKeyPairsResponse>('listSSHKeyPairs', { pagesize: '500', ...params })
    return { count: res.listsshkeypairsresponse.count ?? 0, items: res.listsshkeypairsresponse.sshkeypair ?? [] }
  }

  async listSecurityGroups(params: Record<string, string> = {}) {
    const res = await this.request<ListSecurityGroupsResponse>('listSecurityGroups', { pagesize: '500', ...params })
    return { count: res.listsecuritygroupsresponse.count ?? 0, items: res.listsecuritygroupsresponse.securitygroup ?? [] }
  }

  async listISOs(params: Record<string, string> = {}) {
    const res = await this.request<ListISOsResponse>('listISOs', { pagesize: '500', isofilter: 'executable', ...params })
    return { count: res.listisosresponse.count ?? 0, items: res.listisosresponse.iso ?? [] }
  }

  // ── Admin ────────────────────────────────────────────────

  async listRoles(params: Record<string, string> = {}) {
    const res = await this.request<ListRolesResponse>('listRoles', params)
    return { count: res.listrolesresponse.count ?? 0, items: res.listrolesresponse.role ?? [] }
  }

  async listProjects(params: Record<string, string> = {}) {
    const res = await this.request<ListProjectsResponse>('listProjects', { pagesize: '500', listall: 'true', ...params })
    return { count: res.listprojectsresponse.count ?? 0, items: res.listprojectsresponse.project ?? [] }
  }

  // ── VM Actions ───────────────────────────────────────────

  async startVirtualMachine(id: string) {
    return this.request<AsyncJobResponse>('startVirtualMachine', { id })
  }

  async stopVirtualMachine(id: string, forced = false) {
    return this.request<AsyncJobResponse>('stopVirtualMachine', { id, forced: forced ? 'true' : 'false' })
  }

  async rebootVirtualMachine(id: string) {
    return this.request<AsyncJobResponse>('rebootVirtualMachine', { id })
  }

  async destroyVirtualMachine(id: string) {
    return this.request<AsyncJobResponse>('destroyVirtualMachine', { id })
  }
}

// ── Main singleton — uses session key after login ────────────
// API keys are intentionally NOT set here so that session key
// (set by AuthContext after login) always takes effect.
export const cloudstack = new CloudStackClient()

// ── API-key-only client — used by /cloud page ─────────────────
// This client authenticates exclusively via HMAC-SHA1 signed requests
// and does NOT depend on a user session.
export const cloudstackApiKey = new CloudStackClient({
  apiKey:    '***REMOVED_API_KEY***',
  secretKey: '***REMOVED_SECRET_KEY***',
})
