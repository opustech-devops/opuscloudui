import { useState, useEffect, useCallback, type ReactNode } from 'react'
import Sidebar, { type Section } from '../components/Sidebar'
import { useAuth } from '../context/AuthContext'
import { cloudstack } from '../api/cloudstack'
import type {
  VirtualMachine,
  Volume,
  Network,
  PublicIpAddress,
  Snapshot,
} from '../types'
import './DashboardPage.css'

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(bytes: number) {
  const gb = bytes / (1024 ** 3)
  if (gb >= 1) return `${gb.toFixed(0)} GB`
  const mb = bytes / (1024 ** 2)
  return `${mb.toFixed(0)} MB`
}

function initials(name: string) {
  return name
    .split(/[\s._-]/)
    .slice(0, 2)
    .map(s => s[0]?.toUpperCase() ?? '')
    .join('')
}

function roleLabel(role: string) {
  const map: Record<string, string> = {
    'root-admin':    'Root Admin',
    'domain-admin':  'Domain Admin',
    'user':          'Usuário',
  }
  return map[role] ?? role
}

// ── VM status badge ────────────────────────────────────────────────────────

function VMBadge({ state }: { state: string }) {
  const cls = state.toLowerCase().replace(/\s+/, '-')
  const labels: Record<string, string> = {
    Running:    'Ativo',
    Stopped:    'Parado',
    Starting:   'Iniciando',
    Stopping:   'Parando',
    Migrating:  'Migrando',
    Error:      'Erro',
    Destroyed:  'Destruído',
    Expunging:  'Removendo',
  }
  return <span className={`badge badge--${cls}`}>{labels[state] ?? state}</span>
}

function VolumeBadge({ state }: { state: string }) {
  const cls = state.toLowerCase()
  const labels: Record<string, string> = {
    Ready:       'Pronto',
    Allocated:   'Alocado',
    Destroy:     'Destruindo',
    Expunging:   'Removendo',
    Uploaded:    'Enviado',
    Uploading:   'Enviando',
    UploadError: 'Erro',
  }
  return <span className={`badge badge--${cls}`}>{labels[state] ?? state}</span>
}

function NetworkBadge({ state }: { state: string }) {
  const cls = state.toLowerCase()
  const labels: Record<string, string> = {
    Implemented: 'Ativo',
    Setup:       'Configurando',
    Allocated:   'Alocada',
    Destroy:     'Removendo',
  }
  return <span className={`badge badge--${cls}`}>{labels[state] ?? state}</span>
}

function IPBadge({ state }: { state: string }) {
  const cls = state.toLowerCase()
  const labels: Record<string, string> = {
    Allocated:   'Alocado',
    Allocating:  'Alocando',
    Free:        'Livre',
    Releasing:   'Liberando',
  }
  return <span className={`badge badge--${cls}`}>{labels[state] ?? state}</span>
}

// ── Skeleton rows ──────────────────────────────────────────────────────────

function SkeletonRows({ cols }: { cols: number }) {
  return (
    <>
      {[1, 2, 3, 4, 5].map(i => (
        <tr key={i} className="skeleton-row">
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j}>
              <span className="skeleton" style={{ width: j === 0 ? '60%' : j % 2 === 0 ? '80%' : '50%' }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

// ── Empty / Error states ───────────────────────────────────────────────────

function EmptyState({ message }: { message?: string }) {
  return (
    <tr>
      <td colSpan={99}>
        <div className="table-state">
          <svg className="table-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
          <p className="table-state-title">Nenhum recurso encontrado</p>
          <p className="table-state-msg">{message ?? 'Nenhum item disponível neste domínio.'}</p>
        </div>
      </td>
    </tr>
  )
}

function ErrorState({ error }: { error: string }) {
  return (
    <tr>
      <td colSpan={99}>
        <div className="table-state table-state--error">
          <svg className="table-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="table-state-title">Erro ao carregar dados</p>
          <p className="table-state-msg">{error}</p>
        </div>
      </td>
    </tr>
  )
}

// ── Data card wrapper ──────────────────────────────────────────────────────

function DataCard({ children }: { children: ReactNode }) {
  return (
    <div className="data-card">
      <div className="data-table-wrap">
        <table className="data-table">{children}</table>
      </div>
    </div>
  )
}

// ── State shape ────────────────────────────────────────────────────────────

interface ResourceState<T> {
  items:   T[]
  loading: boolean
  error:   string
}

function initialState<T>(): ResourceState<T> {
  return { items: [], loading: true, error: '' }
}

// ── Dashboard Page ─────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user, logout } = useAuth()
  const [section,  setSection]  = useState<Section>('overview')
  const [spinning, setSpinning] = useState(false)

  const [vms,       setVms]       = useState<ResourceState<VirtualMachine>>(initialState())
  const [volumes,   setVolumes]   = useState<ResourceState<Volume>>(initialState())
  const [networks,  setNetworks]  = useState<ResourceState<Network>>(initialState())
  const [ips,       setIps]       = useState<ResourceState<PublicIpAddress>>(initialState())
  const [snapshots, setSnapshots] = useState<ResourceState<Snapshot>>(initialState())

  const fetchAll = useCallback(async () => {
    setSpinning(true)

    const [vmRes, volRes, netRes, ipRes, snapRes] = await Promise.allSettled([
      cloudstack.listVirtualMachines(),
      cloudstack.listVolumes(),
      cloudstack.listNetworks(),
      cloudstack.listPublicIpAddresses(),
      cloudstack.listSnapshots(),
    ])

    setVms(vmRes.status === 'fulfilled'
      ? { items: vmRes.value.items, loading: false, error: '' }
      : { items: [], loading: false, error: (vmRes.reason as Error).message })

    setVolumes(volRes.status === 'fulfilled'
      ? { items: volRes.value.items, loading: false, error: '' }
      : { items: [], loading: false, error: (volRes.reason as Error).message })

    setNetworks(netRes.status === 'fulfilled'
      ? { items: netRes.value.items, loading: false, error: '' }
      : { items: [], loading: false, error: (netRes.reason as Error).message })

    setIps(ipRes.status === 'fulfilled'
      ? { items: ipRes.value.items, loading: false, error: '' }
      : { items: [], loading: false, error: (ipRes.reason as Error).message })

    setSnapshots(snapRes.status === 'fulfilled'
      ? { items: snapRes.value.items, loading: false, error: '' }
      : { items: [], loading: false, error: (snapRes.reason as Error).message })

    setSpinning(false)
  }, [])

  useEffect(() => { void fetchAll() }, [fetchAll])

  // ── Section title map ──────────────────────────────────────────────────

  const TITLES: Record<Section, string> = {
    overview:  'Visão Geral',
    vms:       'Máquinas Virtuais',
    volumes:   'Volumes',
    networks:  'Redes',
    ips:       'IPs Públicos',
    snapshots: 'Snapshots',
  }

  // ── Derived stats ──────────────────────────────────────────────────────

  const runningVMs = vms.items.filter(v => v.state === 'Running').length
  const stoppedVMs = vms.items.filter(v => v.state === 'Stopped').length
  const totalGb    = volumes.items.reduce((s, v) => s + v.size, 0) / (1024 ** 3)

  return (
    <div className="dashboard">
      <Sidebar active={section} onChange={setSection} />

      <div className="dashboard-main">

        {/* ── TopBar ─────────────────────────────────────────── */}
        <header className="topbar">
          <span className="topbar-title">{TITLES[section]}</span>

          <div className="topbar-right">
            <button
              className={`topbar-refresh ${spinning ? 'spinning' : ''}`}
              onClick={fetchAll}
              title="Atualizar dados"
            >
              <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
              </svg>
              Atualizar
            </button>

            <div className="topbar-user">
              <div className="topbar-avatar">{initials(user?.username ?? 'U')}</div>
              <span className="topbar-username">{user?.username}</span>
              {user?.role && (
                <span className="topbar-role">{roleLabel(user.role)}</span>
              )}
            </div>

            <button className="topbar-logout" onClick={logout}>
              <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
              </svg>
              Sair
            </button>
          </div>
        </header>

        {/* ── Content ────────────────────────────────────────── */}
        <main className="dashboard-content">

          {/* ── OVERVIEW ─────────────────────────────────────── */}
          {section === 'overview' && (
            <>
              {/* Summary cards */}
              <div className="summary-grid">
                <div className="summary-card">
                  <div className="summary-card-top">
                    <div className="summary-card-icon summary-card-icon--blue">
                      <svg viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M2 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm3.293 1.293a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 01-1.414-1.414L7.586 10 5.293 7.707a1 1 0 010-1.414zm4.414 5.707a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                  <div className="summary-card-value">{vms.loading ? '—' : vms.items.length}</div>
                  <div className="summary-card-label">Máquinas Virtuais</div>
                  {!vms.loading && (
                    <div className="summary-card-sub">
                      <span className="dot-running">{runningVMs} ativas</span>
                      <span className="dot-stopped">{stoppedVMs} paradas</span>
                    </div>
                  )}
                </div>

                <div className="summary-card">
                  <div className="summary-card-top">
                    <div className="summary-card-icon summary-card-icon--purple">
                      <svg viewBox="0 0 20 20" fill="currentColor">
                        <path d="M3 12v3c0 1.657 3.134 3 7 3s7-1.343 7-3v-3c0 1.657-3.134 3-7 3s-7-1.343-7-3z" />
                        <path d="M3 7v3c0 1.657 3.134 3 7 3s7-1.343 7-3V7c0 1.657-3.134 3-7 3S3 8.657 3 7z" />
                        <path d="M17 5c0 1.657-3.134 3-7 3S3 6.657 3 5s3.134-3 7-3 7 1.343 7 3z" />
                      </svg>
                    </div>
                  </div>
                  <div className="summary-card-value">{volumes.loading ? '—' : volumes.items.length}</div>
                  <div className="summary-card-label">Volumes</div>
                  {!volumes.loading && (
                    <div className="summary-card-sub">
                      <span>{totalGb.toFixed(0)} GB total</span>
                    </div>
                  )}
                </div>

                <div className="summary-card">
                  <div className="summary-card-top">
                    <div className="summary-card-icon summary-card-icon--cyan">
                      <svg viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                  <div className="summary-card-value">{networks.loading ? '—' : networks.items.length}</div>
                  <div className="summary-card-label">Redes</div>
                </div>

                <div className="summary-card">
                  <div className="summary-card-top">
                    <div className="summary-card-icon summary-card-icon--green">
                      <svg viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM4.332 8.027a6.012 6.012 0 011.912-2.706C6.512 5.73 6.974 6 7.5 6A1.5 1.5 0 019 7.5V8a2 2 0 004 0 2 2 0 011.523-1.943A5.977 5.977 0 0116 10c0 .34-.028.675-.083 1H15a2 2 0 00-2 2v2.197A5.973 5.973 0 0110 16v-2a2 2 0 00-2-2 2 2 0 01-2-2 2 2 0 00-1.668-1.973z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                  <div className="summary-card-value">{ips.loading ? '—' : ips.items.length}</div>
                  <div className="summary-card-label">IPs Públicos</div>
                  {!ips.loading && (
                    <div className="summary-card-sub">
                      <span>{ips.items.filter(i => i.state === 'Allocated').length} alocados</span>
                    </div>
                  )}
                </div>

                <div className="summary-card">
                  <div className="summary-card-top">
                    <div className="summary-card-icon summary-card-icon--orange">
                      <svg viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4 2a2 2 0 00-2 2v11a3 3 0 106 0V4a2 2 0 00-2-2H4zm1 14a1 1 0 100-2 1 1 0 000 2zm5-1.757l4.9-4.9a2 2 0 000-2.828L13.485 5.1a2 2 0 00-2.828 0L10 5.757v8.486zM16 18H9.071l6-6H16a2 2 0 012 2v2a2 2 0 01-2 2z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                  <div className="summary-card-value">{snapshots.loading ? '—' : snapshots.items.length}</div>
                  <div className="summary-card-label">Snapshots</div>
                </div>
              </div>

              {/* Quick lists */}
              <div className="overview-grid">
                {/* Recent VMs */}
                <div className="data-card">
                  <div className="overview-card-title">
                    Máquinas Virtuais Recentes
                    <button className="overview-card-viewall" onClick={() => setSection('vms')}>
                      Ver todas →
                    </button>
                  </div>
                  <div className="data-table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Nome</th>
                          <th>Estado</th>
                          <th>Zona</th>
                        </tr>
                      </thead>
                      <tbody>
                        {vms.loading && <SkeletonRows cols={3} />}
                        {!vms.loading && vms.error && <ErrorState error={vms.error} />}
                        {!vms.loading && !vms.error && vms.items.length === 0 && <EmptyState />}
                        {!vms.loading && !vms.error && vms.items.slice(0, 5).map(vm => (
                          <tr key={vm.id}>
                            <td>
                              <div className="cell-name">{vm.displayname ?? vm.name}</div>
                              <div className="cell-sub">{vm.serviceofferingname}</div>
                            </td>
                            <td><VMBadge state={vm.state} /></td>
                            <td>{vm.zonename}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Recent IPs */}
                <div className="data-card">
                  <div className="overview-card-title">
                    IPs Públicos
                    <button className="overview-card-viewall" onClick={() => setSection('ips')}>
                      Ver todos →
                    </button>
                  </div>
                  <div className="data-table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Endereço</th>
                          <th>Estado</th>
                          <th>Associado a</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ips.loading && <SkeletonRows cols={3} />}
                        {!ips.loading && ips.error && <ErrorState error={ips.error} />}
                        {!ips.loading && !ips.error && ips.items.length === 0 && <EmptyState />}
                        {!ips.loading && !ips.error && ips.items.slice(0, 5).map(ip => (
                          <tr key={ip.id}>
                            <td><span className="cell-mono">{ip.ipaddress}</span></td>
                            <td><IPBadge state={ip.state} /></td>
                            <td>{ip.virtualmachinename ?? ip.associatednetworkname ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ── VMs ──────────────────────────────────────────── */}
          {section === 'vms' && (
            <>
              <div className="section-header">
                <h2 className="section-title">
                  Máquinas Virtuais
                  {!vms.loading && <span className="section-count">{vms.items.length} instâncias</span>}
                </h2>
              </div>
              <DataCard>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Estado</th>
                    <th>IP</th>
                    <th>CPU / RAM</th>
                    <th>Template</th>
                    <th>Zona</th>
                    <th>Conta</th>
                  </tr>
                </thead>
                <tbody>
                  {vms.loading && <SkeletonRows cols={7} />}
                  {!vms.loading && vms.error && <ErrorState error={vms.error} />}
                  {!vms.loading && !vms.error && vms.items.length === 0 && <EmptyState />}
                  {!vms.loading && !vms.error && vms.items.map(vm => {
                    const ip = vm.nic?.find(n => n.isdefault)?.ipaddress ?? vm.nic?.[0]?.ipaddress
                    return (
                      <tr key={vm.id}>
                        <td>
                          <div className="cell-name">{vm.displayname ?? vm.name}</div>
                          <div className="cell-sub">{vm.serviceofferingname}</div>
                        </td>
                        <td><VMBadge state={vm.state} /></td>
                        <td>{ip ? <span className="cell-mono">{ip}</span> : '—'}</td>
                        <td>{vm.cpunumber} vCPU / {fmt(vm.memory * 1024 * 1024)}</td>
                        <td>
                          <div style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {vm.templatename}
                          </div>
                        </td>
                        <td>{vm.zonename}</td>
                        <td>{vm.account}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </DataCard>
            </>
          )}

          {/* ── VOLUMES ──────────────────────────────────────── */}
          {section === 'volumes' && (
            <>
              <div className="section-header">
                <h2 className="section-title">
                  Volumes
                  {!volumes.loading && (
                    <span className="section-count">
                      {volumes.items.length} volumes · {totalGb.toFixed(0)} GB total
                    </span>
                  )}
                </h2>
              </div>
              <DataCard>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Tipo</th>
                    <th>Tamanho</th>
                    <th>Estado</th>
                    <th>VM Associada</th>
                    <th>Zona</th>
                    <th>Storage</th>
                  </tr>
                </thead>
                <tbody>
                  {volumes.loading && <SkeletonRows cols={7} />}
                  {!volumes.loading && volumes.error && <ErrorState error={volumes.error} />}
                  {!volumes.loading && !volumes.error && volumes.items.length === 0 && <EmptyState />}
                  {!volumes.loading && !volumes.error && volumes.items.map(vol => (
                    <tr key={vol.id}>
                      <td><div className="cell-name">{vol.name}</div></td>
                      <td>
                        <span className={`type-badge type-badge--${vol.type === 'ROOT' ? 'root' : 'data'}`}>
                          {vol.type}
                        </span>
                      </td>
                      <td>{fmt(vol.size)}</td>
                      <td><VolumeBadge state={vol.state} /></td>
                      <td>{vol.virtualmachinename ?? '—'}</td>
                      <td>{vol.zonename}</td>
                      <td>{vol.storagename ?? vol.diskofferingname ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </DataCard>
            </>
          )}

          {/* ── NETWORKS ─────────────────────────────────────── */}
          {section === 'networks' && (
            <>
              <div className="section-header">
                <h2 className="section-title">
                  Redes
                  {!networks.loading && <span className="section-count">{networks.items.length} redes</span>}
                </h2>
              </div>
              <DataCard>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Estado</th>
                    <th>Tipo</th>
                    <th>CIDR</th>
                    <th>Gateway</th>
                    <th>Zona</th>
                    <th>VPC</th>
                  </tr>
                </thead>
                <tbody>
                  {networks.loading && <SkeletonRows cols={7} />}
                  {!networks.loading && networks.error && <ErrorState error={networks.error} />}
                  {!networks.loading && !networks.error && networks.items.length === 0 && <EmptyState />}
                  {!networks.loading && !networks.error && networks.items.map(net => (
                    <tr key={net.id}>
                      <td>
                        <div className="cell-name">{net.name}</div>
                        {net.displaytext && net.displaytext !== net.name && (
                          <div className="cell-sub">{net.displaytext}</div>
                        )}
                      </td>
                      <td><NetworkBadge state={net.state} /></td>
                      <td>{net.type}</td>
                      <td>{net.cidr ? <span className="cell-mono">{net.cidr}</span> : '—'}</td>
                      <td>{net.gateway ? <span className="cell-mono">{net.gateway}</span> : '—'}</td>
                      <td>{net.zonename}</td>
                      <td>{net.vpcname ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </DataCard>
            </>
          )}

          {/* ── PUBLIC IPs ───────────────────────────────────── */}
          {section === 'ips' && (
            <>
              <div className="section-header">
                <h2 className="section-title">
                  IPs Públicos
                  {!ips.loading && <span className="section-count">{ips.items.length} endereços</span>}
                </h2>
              </div>
              <DataCard>
                <thead>
                  <tr>
                    <th>Endereço IP</th>
                    <th>Estado</th>
                    <th>Fonte NAT</th>
                    <th>VM Associada</th>
                    <th>Rede</th>
                    <th>Zona</th>
                    <th>Conta</th>
                  </tr>
                </thead>
                <tbody>
                  {ips.loading && <SkeletonRows cols={7} />}
                  {!ips.loading && ips.error && <ErrorState error={ips.error} />}
                  {!ips.loading && !ips.error && ips.items.length === 0 && <EmptyState />}
                  {!ips.loading && !ips.error && ips.items.map(ip => (
                    <tr key={ip.id}>
                      <td><span className="cell-mono">{ip.ipaddress}</span></td>
                      <td><IPBadge state={ip.state} /></td>
                      <td>
                        {ip.issourcenat
                          ? <span className="badge badge--active">Sim</span>
                          : <span className="badge badge--free">Não</span>}
                      </td>
                      <td>{ip.virtualmachinename ?? '—'}</td>
                      <td>{ip.associatednetworkname ?? '—'}</td>
                      <td>{ip.zonename}</td>
                      <td>{ip.account}</td>
                    </tr>
                  ))}
                </tbody>
              </DataCard>
            </>
          )}

          {/* ── SNAPSHOTS ────────────────────────────────────── */}
          {section === 'snapshots' && (
            <>
              <div className="section-header">
                <h2 className="section-title">
                  Snapshots
                  {!snapshots.loading && <span className="section-count">{snapshots.items.length} snapshots</span>}
                </h2>
              </div>
              <DataCard>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Volume</th>
                    <th>Tipo</th>
                    <th>Estado</th>
                    <th>Criado em</th>
                    <th>Zona</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshots.loading && <SkeletonRows cols={6} />}
                  {!snapshots.loading && snapshots.error && <ErrorState error={snapshots.error} />}
                  {!snapshots.loading && !snapshots.error && snapshots.items.length === 0 && <EmptyState />}
                  {!snapshots.loading && !snapshots.error && snapshots.items.map(snap => (
                    <tr key={snap.id}>
                      <td><div className="cell-name">{snap.name}</div></td>
                      <td>{snap.volumename}</td>
                      <td>{snap.volumetype}</td>
                      <td>
                        <span className={`badge badge--${snap.state.toLowerCase()}`}>{snap.state}</span>
                      </td>
                      <td>{new Date(snap.created).toLocaleDateString('pt-BR')}</td>
                      <td>{snap.zonename ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </DataCard>
            </>
          )}

        </main>
      </div>
    </div>
  )
}
