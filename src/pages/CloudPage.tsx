import React, { useState, useEffect, useCallback, useRef } from 'react'
import './CloudPage.css'
import { cloudstackApiKey as cs } from '../api/cloudstack'

// ── Section types ──────────────────────────────────────────────────────────────

type Section =
  | 'dashboard'
  | 'instances'
  | 'kubernetes'
  | 'ssh-keys'
  | 'security-groups'
  | 'volumes'
  | 'snapshots'
  | 'networks'
  | 'vpcs'
  | 'public-ips'
  | 'templates'
  | 'isos'
  | 'events'
  | 'projects'
  | 'roles'
  | 'accounts'
  | 'domains'
  | 'zones'
  | 'pods'
  | 'clusters'
  | 'hosts'
  | 'primary-storage'
  | 'secondary-storage'
  | 'system-vms'
  | 'routers'
  | 'compute-offerings'
  | 'disk-offerings'
  | 'network-offerings'
  | 'resource-limits'
  | 'alerts'
  | 'api-docs'

interface NavGroup {
  id: string
  label: string
  icon: string
  items: { id: Section; label: string }[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    id: 'compute',
    label: 'Compute',
    icon: '💻',
    items: [
      { id: 'instances', label: 'Instances' },
      { id: 'kubernetes', label: 'Kubernetes' },
      { id: 'ssh-keys', label: 'SSH Key Pairs' },
      { id: 'security-groups', label: 'Security Groups' },
    ],
  },
  {
    id: 'storage',
    label: 'Storage',
    icon: '💾',
    items: [
      { id: 'volumes', label: 'Volumes' },
      { id: 'snapshots', label: 'Snapshots' },
    ],
  },
  {
    id: 'network',
    label: 'Network',
    icon: '🌐',
    items: [
      { id: 'networks', label: 'Guest Networks' },
      { id: 'vpcs', label: 'VPCs' },
      { id: 'public-ips', label: 'Public IP Addresses' },
    ],
  },
  {
    id: 'images',
    label: 'Images',
    icon: '🖼️',
    items: [
      { id: 'templates', label: 'Templates' },
      { id: 'isos', label: 'ISOs' },
    ],
  },
  {
    id: 'infrastructure',
    label: 'Infrastructure',
    icon: '🏗️',
    items: [
      { id: 'zones', label: 'Zones' },
      { id: 'pods', label: 'Pods' },
      { id: 'clusters', label: 'Clusters' },
      { id: 'hosts', label: 'Hosts' },
      { id: 'primary-storage', label: 'Primary Storage' },
      { id: 'secondary-storage', label: 'Secondary Storage' },
      { id: 'system-vms', label: 'System VMs' },
      { id: 'routers', label: 'Virtual Routers' },
    ],
  },
  {
    id: 'offerings',
    label: 'Service Offerings',
    icon: '📦',
    items: [
      { id: 'compute-offerings', label: 'Compute Offerings' },
      { id: 'disk-offerings', label: 'Disk Offerings' },
      { id: 'network-offerings', label: 'Network Offerings' },
    ],
  },
  {
    id: 'admin',
    label: 'Administration',
    icon: '🔧',
    items: [
      { id: 'accounts', label: 'Accounts' },
      { id: 'domains', label: 'Domains' },
      { id: 'roles', label: 'Roles' },
      { id: 'projects', label: 'Projects' },
    ],
  },
  {
    id: 'tools',
    label: 'Tools',
    icon: '🛠️',
    items: [
      { id: 'resource-limits', label: 'Resource Limits' },
      { id: 'alerts', label: 'Alerts' },
    ],
  },
]

const NAV_SINGLES: { id: Section; label: string; icon: string }[] = [
  { id: 'events', label: 'Events', icon: '📋' },
  { id: 'api-docs', label: 'API Explorer', icon: '📡' },
]

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtBytes(bytes: number, decimals = 1): string {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`
}

function fmtMHz(mhz: number): string {
  if (mhz >= 1000) return `${(mhz / 1000).toFixed(1)} GHz`
  return `${mhz} MHz`
}

function pct(used: number, total: number): number {
  if (!total) return 0
  return Math.min(100, Math.round((used / total) * 100))
}

function fmtDate(dateStr: string): string {
  if (!dateStr) return '-'
  try {
    return new Date(dateStr).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return dateStr
  }
}

function statusBadge(state: string): React.ReactElement {
  const cls = `badge badge-${(state || 'unknown').toLowerCase()}`
  return <span className={cls}>{state || 'Unknown'}</span>
}

// ── Capacity bar types ─────────────────────────────────────────────────────────
// 0=MEMORY, 1=CPU_MHz, 2=STORAGE_USED, 3=STORAGE_ALLOCATED,
// 4=PUBLIC_IP, 5=PRIVATE_IP, 6=SECONDARY_STORAGE, 7=VLAN,
// 9=LOCAL_STORAGE, 11=CPU_CORES

interface CapacityEntry {
  capacitytype: number
  capacityused: number
  capacitytotal: number
  percentused: string
  zonename?: string
}

// ── CapacityBar component ──────────────────────────────────────────────────────

interface CapacityBarProps {
  label: string
  used: number
  total: number
  fmtFn?: (n: number) => string
  extra?: string
}

function CapacityBar({ label, used, total, fmtFn, extra }: CapacityBarProps) {
  const p = pct(used, total)
  const fillClass = p >= 90 ? 'danger' : p >= 75 ? 'warn' : ''
  const fmt = fmtFn ?? String
  return (
    <div className="capacity-item">
      <div className="capacity-label-row">
        <span className="capacity-label">{label}</span>
        <span className="capacity-pct">{p}%</span>
      </div>
      <div className="capacity-bar-bg">
        <div className={`capacity-bar-fill ${fillClass}`} style={{ width: `${p}%` }} />
      </div>
      <div className="capacity-sub">
        {fmt(used)} used of {fmt(total)}{extra ? ` · ${extra}` : ''}
      </div>
    </div>
  )
}

// ── Toast ──────────────────────────────────────────────────────────────────────

interface Toast { id: number; type: 'success' | 'error' | 'info'; message: string }

function ToastContainer({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`}>{t.message}</div>
      ))}
    </div>
  )
}

// ── Loading / empty ────────────────────────────────────────────────────────────

function Loading() {
  return (
    <div className="loading-state">
      <div className="spinner" /><br />Loading…
    </div>
  )
}

function ErrorState({ msg }: { msg: string }) {
  return <div className="error-state">⚠ {msg}</div>
}

function EmptyState({ text = 'No items found.' }: { text?: string }) {
  return <div className="empty-state">{text}</div>
}

// ── Dashboard section ──────────────────────────────────────────────────────────

function Dashboard({ onToast: _onToast }: { onToast: (type: Toast['type'], msg: string) => void }) {
  const [caps, setCaps] = useState<CapacityEntry[]>([])
  const [infra, setInfra] = useState({
    pods: 0, clusters: 0, hosts: 0, hostsAlert: 0,
    storagePools: 0, systemVms: 0, routers: 0, vms: 0,
  })
  const [alerts, setAlerts] = useState<any[]>([])
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [capRes, podsRes, clustersRes, hostsRes, spRes, svmsRes, routersRes, vmsRes, alertsRes, eventsRes] = await Promise.all([
          cs.listCapacity(),
          cs.listPods(),
          cs.listClusters(),
          cs.listHosts(),
          cs.listStoragePools(),
          cs.listSystemVms(),
          cs.listRouters(),
          cs.listVirtualMachines({ pagesize: '1' }),
          cs.listAlerts({ pagesize: '5' }),
          cs.listEvents({ pagesize: '10' }),
        ])
        if (cancelled) return
        setCaps(capRes.items as unknown as CapacityEntry[])
        setInfra({
          pods: podsRes.count,
          clusters: clustersRes.count,
          hosts: hostsRes.count,
          hostsAlert: hostsRes.items.filter((h: any) => h.state === 'Alert').length,
          storagePools: spRes.count,
          systemVms: svmsRes.count,
          routers: routersRes.count,
          vms: vmsRes.count,
        })
        setAlerts(alertsRes.items)
        setEvents(eventsRes.items)
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Load failed')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  if (loading) return <Loading />
  if (error) return <ErrorState msg={error} />

  const getCapacity = (type: number): CapacityEntry | undefined =>
    caps.filter(c => c.capacitytype === type).reduce<CapacityEntry | undefined>((acc, c) => {
      if (!acc) return c
      return { ...acc, capacityused: acc.capacityused + c.capacityused, capacitytotal: acc.capacitytotal + c.capacitytotal, percentused: '0' }
    }, undefined)

  const mem = getCapacity(0)
  const cpu = getCapacity(1)
  const cpuCores = getCapacity(11)
  const storUsed = getCapacity(2)
  const storAlloc = getCapacity(3)
  const secStor = getCapacity(6)
  const pubIp = getCapacity(4)
  const vlan = getCapacity(7)

  return (
    <>
      <div className="dashboard-grid">
        {/* Infrastructure */}
        <div className="card">
          <div className="card-header"><span className="card-title">Infrastructure</span></div>
          <div className="infra-stats">
            <div className="infra-stat">
              <div className="infra-stat-label">Pods</div>
              <div className="infra-stat-value">{infra.pods}</div>
            </div>
            <div className="infra-stat">
              <div className="infra-stat-label">Clusters</div>
              <div className="infra-stat-value">{infra.clusters}</div>
            </div>
            <div className="infra-stat">
              <div className="infra-stat-label">Hosts</div>
              <div className="infra-stat-value">{infra.hosts}</div>
            </div>
            <div className="infra-stat">
              <div className="infra-stat-label">Hosts in Alert</div>
              <div className={`infra-stat-value ${infra.hostsAlert > 0 ? 'alert-value' : ''}`}>{infra.hostsAlert}</div>
            </div>
            <div className="infra-stat">
              <div className="infra-stat-label">Primary Storage</div>
              <div className="infra-stat-value">{infra.storagePools}</div>
            </div>
            <div className="infra-stat">
              <div className="infra-stat-label">System VMs</div>
              <div className="infra-stat-value">{infra.systemVms}</div>
            </div>
            <div className="infra-stat">
              <div className="infra-stat-label">Virtual Routers</div>
              <div className="infra-stat-value">{infra.routers}</div>
            </div>
            <div className="infra-stat">
              <div className="infra-stat-label">Instances</div>
              <div className="infra-stat-value">{infra.vms}</div>
            </div>
          </div>
        </div>

        {/* Compute capacity */}
        <div className="card">
          <div className="card-header"><span className="card-title">Compute Capacity</span></div>
          <div className="card-body">
            {mem && <CapacityBar label="Memory" used={mem.capacityused} total={mem.capacitytotal} fmtFn={fmtBytes} />}
            {cpu && <CapacityBar label="CPU (MHz)" used={cpu.capacityused} total={cpu.capacitytotal} fmtFn={fmtMHz} />}
            {cpuCores && <CapacityBar label="CPU Cores" used={cpuCores.capacityused} total={cpuCores.capacitytotal} />}
            {!mem && !cpu && !cpuCores && <EmptyState text="No capacity data available." />}
          </div>
        </div>

        {/* Storage capacity */}
        <div className="card">
          <div className="card-header"><span className="card-title">Storage Capacity</span></div>
          <div className="card-body">
            {storUsed && <CapacityBar label="Primary (Used)" used={storUsed.capacityused} total={storUsed.capacitytotal} fmtFn={fmtBytes} />}
            {storAlloc && <CapacityBar label="Primary (Allocated)" used={storAlloc.capacityused} total={storAlloc.capacitytotal} fmtFn={fmtBytes} />}
            {secStor && <CapacityBar label="Secondary Storage" used={secStor.capacityused} total={secStor.capacitytotal} fmtFn={fmtBytes} />}
            {!storUsed && !secStor && <EmptyState text="No storage capacity data." />}
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        {/* Network capacity */}
        <div className="card">
          <div className="card-header"><span className="card-title">Network Capacity</span></div>
          <div className="card-body">
            {vlan && <CapacityBar label="VLANs" used={vlan.capacityused} total={vlan.capacitytotal} />}
            {pubIp && <CapacityBar label="Public IPs" used={pubIp.capacityused} total={pubIp.capacitytotal} />}
            {!vlan && !pubIp && <EmptyState text="No network capacity data." />}
          </div>
        </div>

        {/* Alerts */}
        <div className="card">
          <div className="card-header"><span className="card-title">Recent Alerts</span></div>
          <div className="card-body" style={{ padding: '8px 16px' }}>
            {alerts.length === 0 ? (
              <EmptyState text="No recent alerts." />
            ) : (
              <ul className="alert-list">
                {alerts.map((a: any) => (
                  <li key={a.id} className="alert-item">
                    <div className="alert-item-type">{a.name || `Type ${a.type}`}</div>
                    <div className="alert-item-desc">{a.description}</div>
                    <div className="alert-item-time">{fmtDate(a.sent)}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Events */}
        <div className="card">
          <div className="card-header"><span className="card-title">Recent Events</span></div>
          <div className="card-body" style={{ padding: '8px 16px' }}>
            {events.length === 0 ? (
              <EmptyState text="No recent events." />
            ) : (
              <ul className="event-list">
                {events.map((e: any) => (
                  <li key={e.id} className="event-item">
                    <div className={`event-state ${e.state || 'unknown'}`} />
                    <div className="event-desc">{e.type} — {e.description}</div>
                    <div className="event-time">{fmtDate(e.created)}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

// ── Generic list section ──────────────────────────────────────────────────────

interface Column<T> {
  header: string
  accessor: keyof T | ((row: T) => React.ReactNode)
  width?: string
}

interface ListSectionProps<T> {
  loadFn: () => Promise<{ count: number; items: T[] }>
  columns: Column<T>[]
  searchFields?: (keyof T)[]
  title: string
  actions?: (row: T, reload: () => void, toast: (type: Toast['type'], msg: string) => void) => React.ReactNode
  onToast: (type: Toast['type'], msg: string) => void
  extraToolbar?: React.ReactNode
}

function ListSection<T extends Record<string, any>>({
  loadFn, columns, searchFields, title, actions, onToast, extraToolbar,
}: ListSectionProps<T>) {
  const [items, setItems] = useState<T[]>([])
  const [filtered, setFiltered] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const mountedRef = useRef(true)

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false } }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await loadFn()
      if (!mountedRef.current) return
      setItems(res.items)
      setFiltered(res.items)
      setQuery('')
    } catch (e: any) {
      if (!mountedRef.current) return
      setError(e.message || 'Failed to load')
    } finally {
      if (!mountedRef.current) return
      setLoading(false)
    }
  }, [loadFn])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!query.trim()) { setFiltered(items); return }
    const q = query.toLowerCase()
    const fields = searchFields ?? (['name', 'id'] as (keyof T)[])
    setFiltered(items.filter(item =>
      fields.some(f => String(item[f] ?? '').toLowerCase().includes(q))
    ))
  }, [query, items, searchFields])

  return (
    <>
      <div className="section-toolbar">
        <input
          className="search-box"
          placeholder={`Search ${title.toLowerCase()}…`}
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <button className="btn btn-secondary btn-sm" onClick={load} disabled={loading}>
          ↻ Refresh
        </button>
        {extraToolbar}
        {!loading && <span style={{ color: '#6b7280', fontSize: 12 }}>{filtered.length} item{filtered.length !== 1 ? 's' : ''}</span>}
      </div>

      {loading ? <Loading /> : error ? <ErrorState msg={error} /> : (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                {columns.map((col, i) => (
                  <th key={i} style={col.width ? { width: col.width } : undefined}>
                    {col.header}
                  </th>
                ))}
                {actions && <th style={{ width: '130px' }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={columns.length + (actions ? 1 : 0)} style={{ textAlign: 'center', padding: '32px', color: '#9ca3af' }}>No items found.</td></tr>
              ) : filtered.map((row, ri) => (
                <tr key={(row.id as string) || ri}>
                  {columns.map((col, ci) => (
                    <td key={ci}>
                      {typeof col.accessor === 'function'
                        ? col.accessor(row)
                        : String(row[col.accessor] ?? '-')}
                    </td>
                  ))}
                  {actions && <td>{actions(row, load, onToast)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

// ── Instances section ─────────────────────────────────────────────────────────

function InstancesSection({ onToast }: { onToast: (type: Toast['type'], msg: string) => void }) {
  const [actionPending, setActionPending] = useState<string | null>(null)

  const doAction = async (
    fn: () => Promise<any>,
    vmId: string,
    msg: string,
    reload: () => void,
    onToast: (type: Toast['type'], msg: string) => void
  ) => {
    setActionPending(vmId)
    onToast('info', msg)
    try {
      await fn()
      onToast('success', `${msg} — request sent.`)
      setTimeout(reload, 3000)
    } catch (e: any) {
      onToast('error', e.message || 'Action failed')
    } finally {
      setActionPending(null)
    }
  }

  return (
    <ListSection
      title="Instances"
      loadFn={() => cs.listVirtualMachines({ pagesize: '500', listall: 'true' })}
      searchFields={['name', 'id', 'instancename', 'hostname'] as any}
      onToast={onToast}
      columns={[
        { header: 'Name', accessor: (r: any) => <strong>{r.name}</strong> },
        { header: 'State', accessor: (r: any) => statusBadge(r.state) },
        { header: 'Service Offering', accessor: 'serviceofferingname' as any },
        { header: 'Zone', accessor: 'zonename' as any },
        { header: 'Account', accessor: 'account' as any },
        { header: 'IP Address', accessor: (r: any) => r.nic?.[0]?.ipaddress ?? '-' },
        { header: 'Created', accessor: (r: any) => fmtDate(r.created) },
      ]}
      actions={(row: any, reload, toast) => (
        <div className="vm-actions">
          {row.state === 'Stopped' && (
            <button
              className="btn btn-primary btn-sm btn-icon"
              title="Start"
              disabled={actionPending === row.id}
              onClick={() => doAction(() => cs.startVirtualMachine(row.id), row.id, `Starting ${row.name}`, reload, toast)}
            >▶</button>
          )}
          {row.state === 'Running' && (
            <>
              <button
                className="btn btn-secondary btn-sm btn-icon"
                title="Reboot"
                disabled={actionPending === row.id}
                onClick={() => doAction(() => cs.rebootVirtualMachine(row.id), row.id, `Rebooting ${row.name}`, reload, toast)}
              >↺</button>
              <button
                className="btn btn-danger btn-sm btn-icon"
                title="Stop"
                disabled={actionPending === row.id}
                onClick={() => doAction(() => cs.stopVirtualMachine(row.id), row.id, `Stopping ${row.name}`, reload, toast)}
              >■</button>
            </>
          )}
        </div>
      )}
    />
  )
}

// ── All simple list-based sections ────────────────────────────────────────────

function KubernetesSection({ onToast }: { onToast: (type: Toast['type'], msg: string) => void }) {
  return (
    <ListSection
      title="Kubernetes Clusters"
      loadFn={() => cs.listKubernetesClusters({ pagesize: '500' })}
      searchFields={['name', 'id'] as any}
      onToast={onToast}
      columns={[
        { header: 'Name', accessor: (r: any) => <strong>{r.name}</strong> },
        { header: 'State', accessor: (r: any) => statusBadge(r.state) },
        { header: 'K8s Version', accessor: 'kubernetesversionname' as any },
        { header: 'Nodes', accessor: 'size' as any },
        { header: 'Zone', accessor: 'zonename' as any },
        { header: 'Account', accessor: 'account' as any },
      ]}
    />
  )
}

function SshKeysSection({ onToast }: { onToast: (type: Toast['type'], msg: string) => void }) {
  return (
    <ListSection
      title="SSH Key Pairs"
      loadFn={() => cs.listSSHKeyPairs({ listall: 'true' })}
      searchFields={['name', 'account'] as any}
      onToast={onToast}
      columns={[
        { header: 'Name', accessor: (r: any) => <strong>{r.name}</strong> },
        { header: 'Account', accessor: 'account' as any },
        { header: 'Domain', accessor: 'domain' as any },
        { header: 'Fingerprint', accessor: (r: any) => <code style={{ fontSize: 11 }}>{r.fingerprint}</code> },
      ]}
    />
  )
}

function SecurityGroupsSection({ onToast }: { onToast: (type: Toast['type'], msg: string) => void }) {
  return (
    <ListSection
      title="Security Groups"
      loadFn={() => cs.listSecurityGroups({ listall: 'true' })}
      searchFields={['name', 'account'] as any}
      onToast={onToast}
      columns={[
        { header: 'Name', accessor: (r: any) => <strong>{r.name}</strong> },
        { header: 'Description', accessor: 'description' as any },
        { header: 'Account', accessor: 'account' as any },
        { header: 'Domain', accessor: 'domain' as any },
        { header: 'Ingress Rules', accessor: (r: any) => r.ingressrule?.length ?? 0 },
        { header: 'Egress Rules', accessor: (r: any) => r.egressrule?.length ?? 0 },
      ]}
    />
  )
}

function VolumesSection({ onToast }: { onToast: (type: Toast['type'], msg: string) => void }) {
  return (
    <ListSection
      title="Volumes"
      loadFn={() => cs.listVolumes({ pagesize: '500', listall: 'true' })}
      searchFields={['name', 'id', 'vmname'] as any}
      onToast={onToast}
      columns={[
        { header: 'Name', accessor: (r: any) => <strong>{r.name}</strong> },
        { header: 'State', accessor: (r: any) => statusBadge(r.state) },
        { header: 'Type', accessor: 'type' as any },
        { header: 'Size', accessor: (r: any) => r.size ? fmtBytes(r.size) : '-' },
        { header: 'VM', accessor: 'vmname' as any },
        { header: 'Zone', accessor: 'zonename' as any },
        { header: 'Storage', accessor: 'storage' as any },
      ]}
    />
  )
}

function SnapshotsSection({ onToast }: { onToast: (type: Toast['type'], msg: string) => void }) {
  return (
    <ListSection
      title="Snapshots"
      loadFn={() => cs.listSnapshots({ pagesize: '500', listall: 'true' })}
      searchFields={['name', 'id', 'volumename'] as any}
      onToast={onToast}
      columns={[
        { header: 'Name', accessor: (r: any) => <strong>{r.name}</strong> },
        { header: 'State', accessor: (r: any) => statusBadge(r.state) },
        { header: 'Volume', accessor: 'volumename' as any },
        { header: 'Type', accessor: 'snapshottype' as any },
        { header: 'Account', accessor: 'account' as any },
        { header: 'Created', accessor: (r: any) => fmtDate(r.created) },
      ]}
    />
  )
}

function NetworksSection({ onToast }: { onToast: (type: Toast['type'], msg: string) => void }) {
  return (
    <ListSection
      title="Guest Networks"
      loadFn={() => cs.listNetworks({ pagesize: '500', listall: 'true' })}
      searchFields={['name', 'id', 'account'] as any}
      onToast={onToast}
      columns={[
        { header: 'Name', accessor: (r: any) => <strong>{r.name}</strong> },
        { header: 'State', accessor: (r: any) => statusBadge(r.state) },
        { header: 'Zone', accessor: 'zonename' as any },
        { header: 'CIDR', accessor: 'cidr' as any },
        { header: 'Type', accessor: 'type' as any },
        { header: 'Account', accessor: 'account' as any },
        { header: 'Offering', accessor: 'networkofferingname' as any },
      ]}
    />
  )
}

function VpcsSection({ onToast }: { onToast: (type: Toast['type'], msg: string) => void }) {
  return (
    <ListSection
      title="VPCs"
      loadFn={() => cs.listVpcs({ pagesize: '500', listall: 'true' })}
      searchFields={['name', 'id', 'account'] as any}
      onToast={onToast}
      columns={[
        { header: 'Name', accessor: (r: any) => <strong>{r.name}</strong> },
        { header: 'State', accessor: (r: any) => statusBadge(r.state) },
        { header: 'Zone', accessor: 'zonename' as any },
        { header: 'CIDR', accessor: 'cidr' as any },
        { header: 'Account', accessor: 'account' as any },
        { header: 'Offering', accessor: 'vpcofferingname' as any },
      ]}
    />
  )
}

function PublicIpsSection({ onToast }: { onToast: (type: Toast['type'], msg: string) => void }) {
  return (
    <ListSection
      title="Public IP Addresses"
      loadFn={() => cs.listPublicIpAddresses({ pagesize: '500', listall: 'true' })}
      searchFields={['ipaddress', 'id', 'account'] as any}
      onToast={onToast}
      columns={[
        { header: 'IP Address', accessor: (r: any) => <strong>{r.ipaddress}</strong> },
        { header: 'State', accessor: (r: any) => statusBadge(r.state) },
        { header: 'Zone', accessor: 'zonename' as any },
        { header: 'Account', accessor: 'account' as any },
        { header: 'VM', accessor: 'virtualmachinename' as any },
        { header: 'Allocated', accessor: (r: any) => fmtDate(r.allocated) },
      ]}
    />
  )
}

function TemplatesSection({ onToast }: { onToast: (type: Toast['type'], msg: string) => void }) {
  return (
    <ListSection
      title="Templates"
      loadFn={() => cs.listTemplates({ pagesize: '500', templatefilter: 'executable' })}
      searchFields={['name', 'id', 'ostypename'] as any}
      onToast={onToast}
      columns={[
        { header: 'Name', accessor: (r: any) => <strong>{r.name}</strong> },
        { header: 'Status', accessor: (r: any) => statusBadge(r.status || r.state || 'Ready') },
        { header: 'OS Type', accessor: 'ostypename' as any },
        { header: 'Zone', accessor: 'zonename' as any },
        { header: 'Size', accessor: (r: any) => r.size ? fmtBytes(r.size) : '-' },
        { header: 'Public', accessor: (r: any) => r.ispublic ? 'Yes' : 'No' },
        { header: 'Created', accessor: (r: any) => fmtDate(r.created) },
      ]}
    />
  )
}

function ISOsSection({ onToast }: { onToast: (type: Toast['type'], msg: string) => void }) {
  return (
    <ListSection
      title="ISOs"
      loadFn={() => cs.listISOs({ pagesize: '500' })}
      searchFields={['name', 'id', 'ostypename'] as any}
      onToast={onToast}
      columns={[
        { header: 'Name', accessor: (r: any) => <strong>{r.name}</strong> },
        { header: 'Zone', accessor: 'zonename' as any },
        { header: 'OS Type', accessor: 'ostypename' as any },
        { header: 'Public', accessor: (r: any) => r.ispublic ? 'Yes' : 'No' },
        { header: 'Bootable', accessor: (r: any) => r.bootable ? 'Yes' : 'No' },
        { header: 'Created', accessor: (r: any) => fmtDate(r.created) },
      ]}
    />
  )
}

function EventsSection({ onToast }: { onToast: (type: Toast['type'], msg: string) => void }) {
  return (
    <ListSection
      title="Events"
      loadFn={() => cs.listEvents({ pagesize: '100', listall: 'true' })}
      searchFields={['type', 'description', 'account'] as any}
      onToast={onToast}
      columns={[
        { header: 'State', accessor: (r: any) => statusBadge(r.state) },
        { header: 'Type', accessor: 'type' as any },
        { header: 'Description', accessor: 'description' as any },
        { header: 'Account', accessor: 'account' as any },
        { header: 'Date', accessor: (r: any) => fmtDate(r.created) },
      ]}
    />
  )
}

function ProjectsSection({ onToast }: { onToast: (type: Toast['type'], msg: string) => void }) {
  return (
    <ListSection
      title="Projects"
      loadFn={() => cs.listProjects()}
      searchFields={['name', 'id', 'account'] as any}
      onToast={onToast}
      columns={[
        { header: 'Name', accessor: (r: any) => <strong>{r.name}</strong> },
        { header: 'State', accessor: (r: any) => statusBadge(r.state) },
        { header: 'Account', accessor: 'account' as any },
        { header: 'Domain', accessor: 'domain' as any },
        { header: 'VMs', accessor: 'vmtotal' as any },
        { header: 'Volumes', accessor: 'volumetotal' as any },
      ]}
    />
  )
}

function RolesSection({ onToast }: { onToast: (type: Toast['type'], msg: string) => void }) {
  return (
    <ListSection
      title="Roles"
      loadFn={() => cs.listRoles()}
      searchFields={['name', 'id'] as any}
      onToast={onToast}
      columns={[
        { header: 'Name', accessor: (r: any) => <strong>{r.name}</strong> },
        { header: 'Type', accessor: 'type' as any },
        { header: 'Description', accessor: 'description' as any },
        { header: 'ID', accessor: (r: any) => <code style={{ fontSize: 11 }}>{r.id}</code> },
      ]}
    />
  )
}

function AccountsSection({ onToast }: { onToast: (type: Toast['type'], msg: string) => void }) {
  return (
    <ListSection
      title="Accounts"
      loadFn={() => cs.listAccounts()}
      searchFields={['name', 'id', 'domain'] as any}
      onToast={onToast}
      columns={[
        { header: 'Name', accessor: (r: any) => <strong>{r.name}</strong> },
        { header: 'State', accessor: (r: any) => statusBadge(r.state) },
        { header: 'Type', accessor: (r: any) => ({ 0: 'User', 1: 'Admin', 2: 'Domain-Admin' }[r.accounttype as number] ?? r.accounttype) },
        { header: 'Domain', accessor: 'domain' as any },
        { header: 'VMs', accessor: 'vmtotal' as any },
        { header: 'Volumes', accessor: 'volumetotal' as any },
        { header: 'IPs', accessor: 'iptotal' as any },
      ]}
    />
  )
}

function DomainsSection({ onToast }: { onToast: (type: Toast['type'], msg: string) => void }) {
  return (
    <ListSection
      title="Domains"
      loadFn={() => cs.listDomains()}
      searchFields={['name', 'id', 'path'] as any}
      onToast={onToast}
      columns={[
        { header: 'Name', accessor: (r: any) => <strong>{r.name}</strong> },
        { header: 'Level', accessor: 'level' as any },
        { header: 'Path', accessor: 'path' as any },
        { header: 'VMs', accessor: 'vmtotal' as any },
        { header: 'Accounts', accessor: 'accounttotal' as any },
        { header: 'Parent', accessor: 'parentdomainname' as any },
      ]}
    />
  )
}

// ── Infrastructure sections ────────────────────────────────────────────────────

function ZonesSection({ onToast }: { onToast: (type: Toast['type'], msg: string) => void }) {
  return (
    <ListSection
      title="Zones"
      loadFn={() => cs.listZones({ showsecretkey: 'false' })}
      searchFields={['name', 'id'] as any}
      onToast={onToast}
      columns={[
        { header: 'Name', accessor: (r: any) => <strong>{r.name}</strong> },
        { header: 'Allocation State', accessor: (r: any) => statusBadge(r.allocationstate) },
        { header: 'Type', accessor: 'networktype' as any },
        { header: 'Local Storage', accessor: (r: any) => r.localstorageenabled ? 'Enabled' : 'Disabled' },
        { header: 'Security Groups', accessor: (r: any) => r.securitygroupsenabled ? 'Enabled' : 'Disabled' },
        { header: 'ID', accessor: (r: any) => <code style={{ fontSize: 11 }}>{r.id}</code> },
      ]}
    />
  )
}

function PodsSection({ onToast }: { onToast: (type: Toast['type'], msg: string) => void }) {
  return (
    <ListSection
      title="Pods"
      loadFn={() => cs.listPods()}
      searchFields={['name', 'id', 'zonename'] as any}
      onToast={onToast}
      columns={[
        { header: 'Name', accessor: (r: any) => <strong>{r.name}</strong> },
        { header: 'State', accessor: (r: any) => statusBadge(r.allocationstate) },
        { header: 'Zone', accessor: 'zonename' as any },
        { header: 'Gateway', accessor: 'gateway' as any },
        { header: 'Netmask', accessor: 'netmask' as any },
        { header: 'Start IP', accessor: 'startip' as any },
        { header: 'End IP', accessor: 'endip' as any },
      ]}
    />
  )
}

function ClustersSection({ onToast }: { onToast: (type: Toast['type'], msg: string) => void }) {
  return (
    <ListSection
      title="Clusters"
      loadFn={() => cs.listClusters()}
      searchFields={['name', 'id', 'zonename'] as any}
      onToast={onToast}
      columns={[
        { header: 'Name', accessor: (r: any) => <strong>{r.name}</strong> },
        { header: 'State', accessor: (r: any) => statusBadge(r.allocationstate) },
        { header: 'Zone', accessor: 'zonename' as any },
        { header: 'Pod', accessor: 'podname' as any },
        { header: 'Type', accessor: 'hypervisortype' as any },
        { header: 'Managed State', accessor: 'managedstate' as any },
      ]}
    />
  )
}

function HostsSection({ onToast }: { onToast: (type: Toast['type'], msg: string) => void }) {
  return (
    <ListSection
      title="Hosts"
      loadFn={() => cs.listHosts({ type: 'Routing' })}
      searchFields={['name', 'id', 'ipaddress', 'zonename'] as any}
      onToast={onToast}
      columns={[
        { header: 'Name', accessor: (r: any) => <strong>{r.name}</strong> },
        { header: 'State', accessor: (r: any) => statusBadge(r.state) },
        { header: 'Zone', accessor: 'zonename' as any },
        { header: 'Cluster', accessor: 'clustername' as any },
        { header: 'IP', accessor: 'ipaddress' as any },
        { header: 'Hypervisor', accessor: 'hypervisor' as any },
        { header: 'CPU Used', accessor: (r: any) => r.cpunumber ? `${r.cpuused ?? 0}%` : '-' },
        { header: 'Mem Used', accessor: (r: any) => r.memorytotal ? fmtBytes(r.memoryused ?? 0) : '-' },
      ]}
    />
  )
}

function PrimaryStorageSection({ onToast }: { onToast: (type: Toast['type'], msg: string) => void }) {
  return (
    <ListSection
      title="Primary Storage"
      loadFn={() => cs.listStoragePools({ type: 'NetworkFilesystem,IscsiLUN,Filesystem,LVM,CLVM,RBD,SharedMountPoint,StorPool,DatastoreCluster,Rados,Gluster,FiberChannel,OCFS2,SMB' })}
      searchFields={['name', 'id', 'zonename'] as any}
      onToast={onToast}
      columns={[
        { header: 'Name', accessor: (r: any) => <strong>{r.name}</strong> },
        { header: 'State', accessor: (r: any) => statusBadge(r.state) },
        { header: 'Zone', accessor: 'zonename' as any },
        { header: 'Cluster', accessor: 'clustername' as any },
        { header: 'Type', accessor: 'type' as any },
        { header: 'Capacity', accessor: (r: any) => r.disksizetotal ? fmtBytes(r.disksizetotal) : '-' },
        { header: 'Used', accessor: (r: any) => r.disksizeused ? fmtBytes(r.disksizeused) : '-' },
      ]}
    />
  )
}

function SecondaryStorageSection({ onToast }: { onToast: (type: Toast['type'], msg: string) => void }) {
  return (
    <ListSection
      title="Secondary Storage (Image Stores)"
      loadFn={() => cs.listStoragePools({ scope: 'ZONE' })}
      searchFields={['name', 'id', 'zonename'] as any}
      onToast={onToast}
      columns={[
        { header: 'Name', accessor: (r: any) => <strong>{r.name}</strong> },
        { header: 'State', accessor: (r: any) => statusBadge(r.state) },
        { header: 'Zone', accessor: 'zonename' as any },
        { header: 'Type', accessor: 'type' as any },
        { header: 'Protocol', accessor: 'type' as any },
        { header: 'Capacity', accessor: (r: any) => r.disksizetotal ? fmtBytes(r.disksizetotal) : '-' },
      ]}
    />
  )
}

function SystemVmsSection({ onToast }: { onToast: (type: Toast['type'], msg: string) => void }) {
  return (
    <ListSection
      title="System VMs"
      loadFn={() => cs.listSystemVms()}
      searchFields={['name', 'id', 'zonename', 'systemvmtype'] as any}
      onToast={onToast}
      columns={[
        { header: 'Name', accessor: (r: any) => <strong>{r.name}</strong> },
        { header: 'State', accessor: (r: any) => statusBadge(r.state) },
        { header: 'Type', accessor: 'systemvmtype' as any },
        { header: 'Zone', accessor: 'zonename' as any },
        { header: 'Public IP', accessor: 'publicip' as any },
        { header: 'Private IP', accessor: 'privateip' as any },
        { header: 'Agent State', accessor: (r: any) => statusBadge(r.agentstate) },
      ]}
    />
  )
}

function RoutersSection({ onToast }: { onToast: (type: Toast['type'], msg: string) => void }) {
  return (
    <ListSection
      title="Virtual Routers"
      loadFn={() => cs.listRouters({ listall: 'true' })}
      searchFields={['name', 'id', 'zonename', 'account'] as any}
      onToast={onToast}
      columns={[
        { header: 'Name', accessor: (r: any) => <strong>{r.name}</strong> },
        { header: 'State', accessor: (r: any) => statusBadge(r.state) },
        { header: 'Zone', accessor: 'zonename' as any },
        { header: 'Account', accessor: 'account' as any },
        { header: 'Version', accessor: 'version' as any },
        { header: 'Public IP', accessor: (r: any) => r.nic?.find((n: any) => n.traffictype === 'Guest')?.ipaddress ?? '-' },
        { header: 'Redundant', accessor: (r: any) => r.isredundantrouter ? 'Yes' : 'No' },
      ]}
    />
  )
}

// ── Offering sections ─────────────────────────────────────────────────────────

function ComputeOfferingsSection({ onToast }: { onToast: (type: Toast['type'], msg: string) => void }) {
  return (
    <ListSection
      title="Compute Offerings"
      loadFn={() => cs.listServiceOfferings()}
      searchFields={['name', 'id'] as any}
      onToast={onToast}
      columns={[
        { header: 'Name', accessor: (r: any) => <strong>{r.name}</strong> },
        { header: 'CPU', accessor: (r: any) => r.cpunumber ? `${r.cpunumber} × ${r.cpuspeed} MHz` : 'Custom' },
        { header: 'Memory', accessor: (r: any) => r.memory ? `${r.memory} MB` : 'Custom' },
        { header: 'Storage Type', accessor: 'storagetype' as any },
        { header: 'Tags', accessor: 'tags' as any },
        { header: 'System?', accessor: (r: any) => r.issystem ? 'Yes' : 'No' },
      ]}
    />
  )
}

function DiskOfferingsSection({ onToast }: { onToast: (type: Toast['type'], msg: string) => void }) {
  return (
    <ListSection
      title="Disk Offerings"
      loadFn={() => cs.listDiskOfferings()}
      searchFields={['name', 'id'] as any}
      onToast={onToast}
      columns={[
        { header: 'Name', accessor: (r: any) => <strong>{r.name}</strong> },
        { header: 'Disk Size', accessor: (r: any) => r.disksize ? `${r.disksize} GB` : 'Custom' },
        { header: 'Storage Type', accessor: 'storagetype' as any },
        { header: 'Tags', accessor: 'tags' as any },
        { header: 'Custom IOPS', accessor: (r: any) => r.iscustomizediops ? 'Yes' : 'No' },
      ]}
    />
  )
}

function NetworkOfferingsSection({ onToast }: { onToast: (type: Toast['type'], msg: string) => void }) {
  return (
    <ListSection
      title="Network Offerings"
      loadFn={() => cs.listNetworkOfferings({ state: 'Enabled' })}
      searchFields={['name', 'id'] as any}
      onToast={onToast}
      columns={[
        { header: 'Name', accessor: (r: any) => <strong>{r.name}</strong> },
        { header: 'State', accessor: (r: any) => statusBadge(r.state) },
        { header: 'Guest Type', accessor: 'guestiptype' as any },
        { header: 'Traffic Type', accessor: 'traffictype' as any },
        { header: 'Availability', accessor: 'availability' as any },
        { header: 'VPC', accessor: (r: any) => r.forvpc ? 'Yes' : 'No' },
      ]}
    />
  )
}

// ── Resource limits & Alerts ─────────────────────────────────────────────────────

const LIMIT_TYPE_NAMES: Record<number, string> = {
  0: 'Instances', 1: 'Public IPs', 2: 'Volumes', 3: 'Snapshots',
  4: 'Templates', 5: 'Projects', 6: 'Networks', 7: 'VPCs',
  8: 'CPUs', 9: 'Memory (MB)', 10: 'Primary Storage (GB)',
  11: 'Secondary Storage (GB)',
}

function ResourceLimitsSection({ onToast }: { onToast: (type: Toast['type'], msg: string) => void }) {
  return (
    <ListSection
      title="Resource Limits"
      loadFn={() => cs.listResourceLimits({ listall: 'true' })}
      searchFields={['account', 'domain'] as any}
      onToast={onToast}
      columns={[
        { header: 'Resource Type', accessor: (r: any) => LIMIT_TYPE_NAMES[r.resourcetype] ?? `Type ${r.resourcetype}` },
        { header: 'Max', accessor: (r: any) => r.max === -1 ? 'Unlimited' : r.max },
        { header: 'Account', accessor: 'account' as any },
        { header: 'Domain', accessor: 'domain' as any },
      ]}
    />
  )
}

function AlertsSection({ onToast }: { onToast: (type: Toast['type'], msg: string) => void }) {
  return (
    <ListSection
      title="Alerts"
      loadFn={() => cs.listAlerts({ pagesize: '100' })}
      searchFields={['name', 'description'] as any}
      onToast={onToast}
      columns={[
        { header: 'Type', accessor: (r: any) => <strong>{r.name || `Type ${r.type}`}</strong> },
        { header: 'Description', accessor: 'description' as any },
        { header: 'Sent', accessor: (r: any) => fmtDate(r.sent) },
        { header: 'ID', accessor: (r: any) => <code style={{ fontSize: 11 }}>{r.id}</code> },
      ]}
    />
  )
}

// ── API Docs section ──────────────────────────────────────────────────────────

function ApiDocsSection({ onToast: _onToast }: { onToast: (type: Toast['type'], msg: string) => void }) {
  const [apis, setApis] = useState<any[]>([])
  const [filtered, setFiltered] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<any>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await cs.listApis() as any
        const list = res?.listapisresponse?.api ?? []
        if (!cancelled) {
          setApis(list)
          setFiltered(list)
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Failed to load')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
  }, [])

  useEffect(() => {
    if (!query.trim()) { setFiltered(apis); return }
    const q = query.toLowerCase()
    setFiltered(apis.filter((a: any) =>
      a.name?.toLowerCase().includes(q) || a.description?.toLowerCase().includes(q)
    ))
  }, [query, apis])

  return (
    <div>
      <div className="section-toolbar">
        <input
          className="search-box"
          placeholder="Search API commands…"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        {!loading && <span style={{ color: '#6b7280', fontSize: 12 }}>{filtered.length} commands</span>}
      </div>
      {loading ? <Loading /> : error ? <ErrorState msg={error} /> : (
        <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 1fr' : '1fr', gap: 16 }}>
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Command</th>
                  <th>Since</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((api: any) => (
                  <tr
                    key={api.name}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSelected(selected?.name === api.name ? null : api)}
                  >
                    <td><code style={{ color: '#1070ca', fontWeight: 600 }}>{api.name}</code></td>
                    <td style={{ color: '#9ca3af', fontSize: 11 }}>{api.since ?? '-'}</td>
                    <td style={{ color: '#6b7280', fontSize: 12, maxWidth: 340 }}>{api.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {selected && (
            <div className="card">
              <div className="card-header">
                <span className="card-title"><code style={{ color: '#1070ca' }}>{selected.name}</code></span>
                <button className="btn btn-secondary btn-sm" onClick={() => setSelected(null)}>✕</button>
              </div>
              <div className="card-body">
                <p style={{ fontSize: 13, color: '#374151', marginBottom: 12 }}>{selected.description}</p>
                {selected.params?.length > 0 && (
                  <>
                    <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 8, color: '#4b5563', textTransform: 'uppercase' }}>Parameters</div>
                    <table className="data-table" style={{ fontSize: 12 }}>
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Required</th>
                          <th>Type</th>
                          <th>Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selected.params.map((p: any) => (
                          <tr key={p.name}>
                            <td><code style={{ color: '#1070ca' }}>{p.name}</code></td>
                            <td>{p.required ? <span style={{ color: '#dc2626', fontWeight: 600 }}>Yes</span> : 'No'}</td>
                            <td style={{ color: '#6b7280' }}>{p.type}</td>
                            <td style={{ color: '#6b7280', fontSize: 11 }}>{p.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
                {selected.response?.length > 0 && (
                  <>
                    <div style={{ fontWeight: 700, fontSize: 12, marginTop: 16, marginBottom: 8, color: '#4b5563', textTransform: 'uppercase' }}>Response Fields</div>
                    <table className="data-table" style={{ fontSize: 12 }}>
                      <thead><tr><th>Field</th><th>Type</th><th>Description</th></tr></thead>
                      <tbody>
                        {selected.response.slice(0, 30).map((r: any) => (
                          <tr key={r.name}>
                            <td><code>{r.name}</code></td>
                            <td style={{ color: '#6b7280' }}>{r.type}</td>
                            <td style={{ color: '#6b7280', fontSize: 11 }}>{r.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Sidebar navigation ────────────────────────────────────────────────────────

function Sidebar({
  activeSection,
  onSelect,
}: {
  activeSection: Section
  onSelect: (s: Section) => void
}) {
  const [open, setOpen] = useState<Set<string>>(() => {
    const activeGroup = NAV_GROUPS.find(g => g.items.some(i => i.id === activeSection))
    return new Set(activeGroup ? [activeGroup.id] : ['compute'])
  })

  const toggle = (id: string) => {
    setOpen(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <aside className="cloud-sidebar">
      <div className="cloud-sidebar-header">
        <div className="cloud-sidebar-logo">
          <svg width="22" height="22" viewBox="0 0 64 64" fill="none">
            <circle cx="32" cy="32" r="32" fill="#1070ca" />
            <path d="M18 38 Q12 26 22 20 Q24 12 34 14 Q40 8 46 14 Q54 16 52 26 Q58 34 52 40 H18 Z" fill="white" opacity="0.9" />
          </svg>
          OpusCloud
        </div>
      </div>

      <div
        className={`nav-single ${activeSection === 'dashboard' ? 'active' : ''}`}
        onClick={() => onSelect('dashboard')}
      >
        <span className="nav-icon">📊</span>Dashboard
      </div>

      {NAV_GROUPS.map(group => (
        <div key={group.id} className="nav-group">
          <div className="nav-group-header" onClick={() => toggle(group.id)}>
            <span className="nav-group-title">
              <span className="nav-icon">{group.icon}</span>
              {group.label}
            </span>
            <span className={`nav-chevron ${open.has(group.id) ? 'open' : ''}`}>▶</span>
          </div>
          {open.has(group.id) && (
            <div className="nav-group-items">
              {group.items.map(item => (
                <div
                  key={item.id}
                  className={`nav-item ${activeSection === item.id ? 'active' : ''}`}
                  onClick={() => onSelect(item.id)}
                >
                  {item.label}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {NAV_SINGLES.map(item => (
        <div
          key={item.id}
          className={`nav-single ${activeSection === item.id ? 'active' : ''}`}
          onClick={() => onSelect(item.id)}
        >
          <span className="nav-icon">{item.icon}</span>{item.label}
        </div>
      ))}
    </aside>
  )
}

// ── Section title map ─────────────────────────────────────────────────────────

const SECTION_TITLES: Record<Section, string> = {
  dashboard: 'Dashboard',
  instances: 'Instances',
  kubernetes: 'Kubernetes Clusters',
  'ssh-keys': 'SSH Key Pairs',
  'security-groups': 'Security Groups',
  volumes: 'Volumes',
  snapshots: 'Snapshots',
  networks: 'Guest Networks',
  vpcs: 'VPCs',
  'public-ips': 'Public IP Addresses',
  templates: 'Templates',
  isos: 'ISOs',
  events: 'Events',
  projects: 'Projects',
  roles: 'Roles',
  accounts: 'Accounts',
  domains: 'Domains',
  zones: 'Zones',
  pods: 'Pods',
  clusters: 'Clusters',
  hosts: 'Hosts',
  'primary-storage': 'Primary Storage',
  'secondary-storage': 'Secondary Storage',
  'system-vms': 'System VMs',
  routers: 'Virtual Routers',
  'compute-offerings': 'Compute Offerings',
  'disk-offerings': 'Disk Offerings',
  'network-offerings': 'Network Offerings',
  'resource-limits': 'Resource Limits',
  alerts: 'Alerts',
  'api-docs': 'API Explorer',
}

// ── Main CloudPage ────────────────────────────────────────────────────────────

export default function CloudPage() {
  const [section, setSection] = useState<Section>('dashboard')
  const [toasts, setToasts] = useState<Toast[]>([])
  const toastId = useRef(0)

  const addToast = useCallback((type: Toast['type'], message: string) => {
    const id = ++toastId.current
    setToasts(prev => [...prev, { id, type, message }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 4000)
  }, [])

  const handleSelect = (s: Section) => {
    setSection(s)
  }

  const props = { onToast: addToast }

  const renderSection = () => {
    switch (section) {
      case 'dashboard':        return <Dashboard {...props} />
      case 'instances':        return <InstancesSection {...props} />
      case 'kubernetes':       return <KubernetesSection {...props} />
      case 'ssh-keys':         return <SshKeysSection {...props} />
      case 'security-groups':  return <SecurityGroupsSection {...props} />
      case 'volumes':          return <VolumesSection {...props} />
      case 'snapshots':        return <SnapshotsSection {...props} />
      case 'networks':         return <NetworksSection {...props} />
      case 'vpcs':             return <VpcsSection {...props} />
      case 'public-ips':       return <PublicIpsSection {...props} />
      case 'templates':        return <TemplatesSection {...props} />
      case 'isos':             return <ISOsSection {...props} />
      case 'events':           return <EventsSection {...props} />
      case 'projects':         return <ProjectsSection {...props} />
      case 'roles':            return <RolesSection {...props} />
      case 'accounts':         return <AccountsSection {...props} />
      case 'domains':          return <DomainsSection {...props} />
      case 'zones':            return <ZonesSection {...props} />
      case 'pods':             return <PodsSection {...props} />
      case 'clusters':         return <ClustersSection {...props} />
      case 'hosts':            return <HostsSection {...props} />
      case 'primary-storage':  return <PrimaryStorageSection {...props} />
      case 'secondary-storage': return <SecondaryStorageSection {...props} />
      case 'system-vms':       return <SystemVmsSection {...props} />
      case 'routers':          return <RoutersSection {...props} />
      case 'compute-offerings': return <ComputeOfferingsSection {...props} />
      case 'disk-offerings':   return <DiskOfferingsSection {...props} />
      case 'network-offerings': return <NetworkOfferingsSection {...props} />
      case 'resource-limits':  return <ResourceLimitsSection {...props} />
      case 'alerts':           return <AlertsSection {...props} />
      case 'api-docs':         return <ApiDocsSection {...props} />
      default:                 return <EmptyState text="Section not found." />
    }
  }

  return (
    <div className="cloud-layout">
      <Sidebar activeSection={section} onSelect={handleSelect} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div className="cloud-topbar">
          <span className="cloud-topbar-title">{SECTION_TITLES[section]}</span>
          <div className="cloud-topbar-actions">
            <span style={{ fontSize: 12, color: '#6b7280' }}>OpusCloud Management</span>
          </div>
        </div>

        <div className="cloud-body" style={{ overflowY: 'auto' }}>
          {renderSection()}
        </div>
      </div>

      <ToastContainer toasts={toasts} />
    </div>
  )
}
