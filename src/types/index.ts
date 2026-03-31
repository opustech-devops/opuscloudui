// ============================================================
// CloudStack API Types
// ============================================================

// ── Auth ─────────────────────────────────────────────────────

export interface LoginResponse {
  loginresponse: {
    username:        string
    userid:          string
    domainid:        string
    domain:          string
    timeout:         string
    account:         string
    firstname:       string
    lastname:        string
    email:           string
    sessionkey:      string
    /** 0 = user, 1 = domain-admin, 2 = root-admin */
    type:            string
    registered:      string
    /** CloudStack 4.18+: "true" quando 2FA está ativo para o usuário */
    is2FAenabled?:   string
    /** CloudStack 4.18+: "true" quando o código 2FA já foi verificado nesta sessão */
    is2FAverified?:  string
    errorcode?:      number
    errortext?:      string
  }
}

/** Estado intermediário retornado por login() quando 2FA é necessário */
export interface TwoFactorPending {
  requires2FA:  true
  userid:       string
  username:     string
  sessionKey:   string
}

export interface CloudStackError {
  errorresponse: {
    errorcode:    number
    errortext:    string
    cserrorcode?: number
  }
}

export interface CloudStackConfig {
  baseUrl:     string
  apiKey?:     string
  secretKey?:  string
  sessionKey?: string
}

export interface SessionUser {
  username:   string
  userid:     string
  account:    string
  domainid:   string
  domain:     string
  sessionKey: string
  /** 'user' | 'domain-admin' | 'root-admin' */
  role: 'user' | 'domain-admin' | 'root-admin'
}

// ── Virtual Machines ─────────────────────────────────────────

export type VMState =
  | 'Running'
  | 'Stopped'
  | 'Starting'
  | 'Stopping'
  | 'Error'
  | 'Destroyed'
  | 'Expunging'
  | 'Migrating'

export interface VirtualMachine {
  id:                  string
  name:                string
  displayname?:        string
  state:               VMState
  zoneid:              string
  zonename:            string
  templateid:          string
  templatename:        string
  templatedisplaytext?: string
  cpunumber:           number
  memory:              number
  cpuspeed?:           number
  cpuused?:            string
  serviceofferingid?:  string
  serviceofferingname: string
  account:             string
  domainid:            string
  domain:              string
  created:             string
  hypervisor?:         string
  haenable?:           boolean
  isodisplaytext?:     string
  keypair?:            string
  passwordenabled?:    boolean
  publicip?:           string
  nic?: Array<{
    id:        string
    ipaddress: string
    isdefault: boolean
    networkid: string
    networkname: string
    type:      string
  }>
  securitygroup?: Array<{ id: string; name: string }>
  tags?:          Array<{ key: string; value: string }>
  networkkbsread?:  number
  networkkbswrite?: number
  diskgbsread?:     number
  diskgbswrite?:    number
}

export interface ListVMsResponse {
  listvirtualmachinesresponse: {
    count:           number
    virtualmachine?: VirtualMachine[]
  }
}

// ── Volumes ──────────────────────────────────────────────────

export type VolumeState =
  | 'Ready'
  | 'Allocated'
  | 'Destroy'
  | 'Expunging'
  | 'UploadOp'
  | 'Copying'
  | 'Uploaded'
  | 'Uploading'
  | 'NotUploaded'
  | 'UploadError'

export interface Volume {
  id:                    string
  name:                  string
  type:                  'ROOT' | 'DATADISK'
  size:                  number
  state:                 VolumeState
  zoneid:                string
  zonename:              string
  virtualmachineid?:     string
  virtualmachinename?:   string
  vmstate?:              string
  created:               string
  account:               string
  domainid:              string
  domain:                string
  storagetype?:          string
  diskofferingname?:     string
  storageid?:            string
  storagename?:          string
  snapshotid?:           string
  attached?:             string
  isextractable?:        boolean
  miniops?:              number
  maxiops?:              number
}

export interface ListVolumesResponse {
  listvolumesresponse: {
    count:   number
    volume?: Volume[]
  }
}

// ── Networks ─────────────────────────────────────────────────

export interface Network {
  id:                        string
  name:                      string
  displaytext?:              string
  type:                      string
  state:                     string
  zoneid:                    string
  zonename:                  string
  cidr?:                     string
  ip6cidr?:                  string
  gateway?:                  string
  netmask?:                  string
  account:                   string
  domainid:                  string
  domain:                    string
  dns1?:                     string
  dns2?:                     string
  networkofferingid?:        string
  networkofferingname?:      string
  traffictype?:              string
  ispersistent?:             boolean
  isdefault?:                boolean
  restartrequired?:          boolean
  vpcid?:                    string
  vpcname?:                  string
  acltype?:                  string
}

export interface ListNetworksResponse {
  listnetworksresponse: {
    count:    number
    network?: Network[]
  }
}

// ── Public IPs ───────────────────────────────────────────────

export interface PublicIpAddress {
  id:                    string
  ipaddress:             string
  state:                 'Allocated' | 'Allocating' | 'Free' | 'Releasing'
  zoneid:                string
  zonename:              string
  account:               string
  domainid:              string
  domain:                string
  associatednetworkid?:  string
  associatednetworkname?: string
  virtualmachineid?:     string
  virtualmachinename?:   string
  vmipaddress?:          string
  vpcid?:                string
  issourcenat?:          boolean
  isstaticnat?:          boolean
  forvirtualnetwork?:    boolean
  allocated?:            string
}

export interface ListPublicIPsResponse {
  listpublicipaddressesresponse: {
    count:            number
    publicipaddress?: PublicIpAddress[]
  }
}

// ── Snapshots ────────────────────────────────────────────────

export interface Snapshot {
  id:               string
  name:             string
  volumeid:         string
  volumename:       string
  volumetype:       string
  state:            string
  created:          string
  account:          string
  domainid:         string
  domain:           string
  snapshottype?:    string
  intervaltype?:    string
  revertable?:      boolean
  physicalsize?:    number
  virtualsize?:     number
  zoneid?:          string
  zonename?:        string
}

export interface ListSnapshotsResponse {
  listsnapshotsresponse: {
    count:      number
    snapshot?:  Snapshot[]
  }
}

export interface ResourceLimit {
  resourcetype: string
  max:          number | string
  account?:     string
  domain?:      string
  project?:     string
}

export interface ListResourceLimitsResponse {
  listresourcelimitsresponse: {
    count?:        number
    resourcelimit?: ResourceLimit[]
  }
}

export interface CloudEvent {
  id:          string
  username?:   string
  type:        string
  level?:      string
  state?:      string
  description?: string
  created:     string
}

export interface ListEventsResponse {
  listeventsresponse: {
    count?: number
    event?: CloudEvent[]
  }
}

export interface Vpc {
  id:           string
  name:         string
  displaytext?: string
  state:        string
  cidr?:        string
  zonename?:    string
  account?:     string
  domain?:      string
}

export interface ListVpcsResponse {
  listvpcsresponse: {
    count?: number
    vpc?:   Vpc[]
  }
}

export interface Template {
  id:           string
  name:         string
  displaytext?: string
  zonename?:    string
  templatetype?: string
  format?:      string
  hypervisor?:  string
  size?:        number
  created?:     string
}

export interface ListTemplatesResponse {
  listtemplatesresponse: {
    count?:    number
    template?: Template[]
  }
}

export interface KubernetesCluster {
  id:           string
  name:         string
  description?: string
  state?:       string
  version?:     string
  zonename?:    string
}

export interface ListKubernetesClustersResponse {
  listkubernetesclustersresponse: {
    count?:             number
    kubernetescluster?: KubernetesCluster[]
  }
}

// ── Dashboard summary ────────────────────────────────────────

export interface DashboardSummary {
  vms:        { total: number; running: number; stopped: number }
  volumes:    { total: number; totalGb: number }
  networks:   { total: number }
  publicIps:  { total: number }
  snapshots:  { total: number }
}
// ── Capacity ─────────────────────────────────────────────
export interface Capacity {
  type:          number
  capacityused:  number
  capacitytotal: number
  percentused:   string
  zoneid?:       string
  zonename?:     string
  podid?:        string
  podname?:      string
  clusterid?:    string
  clustername?:  string
}
export interface ListCapacityResponse {
  listcapacityresponse: { count?: number; capacity?: Capacity[] }
}

// ── Alerts ───────────────────────────────────────────────
export interface CloudAlert {
  id:          string
  type:        number
  subject:     string
  description: string
  sent:        string
  zoneid?:     string
  zonename?:   string
}
export interface ListAlertsResponse {
  listalertsresponse: { count?: number; alert?: CloudAlert[] }
}

// ── Zones ────────────────────────────────────────────────
export interface Zone {
  id:              string
  name:            string
  displaytext?:    string
  networktype:     string
  allocationstate: string
  dns1?:           string
  dns2?:           string
}
export interface ListZonesResponse {
  listzonesresponse: { count?: number; zone?: Zone[] }
}

// ── Pods ─────────────────────────────────────────────────
export interface Pod {
  id:              string
  name:            string
  zoneid:          string
  zonename:        string
  gateway:         string
  netmask:         string
  startip?:        string
  endip?:          string
  allocationstate: string
}
export interface ListPodsResponse {
  listpodsresponse: { count?: number; pod?: Pod[] }
}

// ── Clusters ─────────────────────────────────────────────
export interface Cluster {
  id:               string
  name:             string
  clustertype:      string
  hypervisortype:   string
  zoneid:           string
  zonename:         string
  podid:            string
  podname:          string
  allocationstate:  string
  managedstate:     string
}
export interface ListClustersResponse {
  listclustersresponse: { count?: number; cluster?: Cluster[] }
}

// ── Hosts ────────────────────────────────────────────────
export interface Host {
  id:             string
  name:           string
  state:          string
  type:           string
  ipaddress?:     string
  zoneid:         string
  zonename:       string
  podname?:       string
  clustername?:   string
  cpunumber?:     number
  cpuspeed?:      number
  cpuallocated?:  string
  cpuused?:       string
  memorytotal?:   number
  memoryused?:    number
  hypervisor?:    string
  resourcestate?: string
  version?:       string
}
export interface ListHostsResponse {
  listhostsresponse: { count?: number; host?: Host[] }
}

// ── Storage Pools (Primary Storage) ──────────────────────
export interface StoragePool {
  id:                 string
  name:               string
  state:              string
  type:               string
  path?:              string
  zoneid:             string
  zonename:           string
  podname?:           string
  clustername?:       string
  disksizetotal?:     number
  disksizeallocated?: number
  disksizeused?:      number
}
export interface ListStoragePoolsResponse {
  liststoragepoolsresponse: { count?: number; storagepool?: StoragePool[] }
}

// ── System VMs ───────────────────────────────────────────
export interface SystemVm {
  id:            string
  name:          string
  state:         string
  systemvmtype:  string
  zoneid:        string
  zonename:      string
  publicip?:     string
  hostname?:     string
  created?:      string
}
export interface ListSystemVmsResponse {
  listsystemvmsresponse: { count?: number; systemvm?: SystemVm[] }
}

// ── Routers ──────────────────────────────────────────────
export interface Router {
  id:               string
  name:             string
  state:            string
  publicip?:        string
  guestnetworkname?: string
  networkdomain?:   string
  zoneid:           string
  zonename:         string
  account?:         string
  domain?:          string
  created?:         string
  version?:         string
  isredundantrouter?: boolean
  redundantstate?:  string
}
export interface ListRoutersResponse {
  listroutersresponse: { count?: number; router?: Router[] }
}

// ── Accounts ─────────────────────────────────────────────
export interface Account {
  id:          string
  name:        string
  accounttype: number
  state:       string
  domain:      string
  domainid:    string
  vmtotal?:    number
  iptotal?:    number
  volumetotal?: number
  vmlimit?:    string
  iplimit?:    string
}
export interface ListAccountsResponse {
  listaccountsresponse: { count?: number; account?: Account[] }
}

// ── Domains ──────────────────────────────────────────────
export interface Domain {
  id:                string
  name:              string
  level:             number
  parentdomainid?:   string
  parentdomainname?: string
  haschild:          boolean
  networkdomain?:    string
  state?:            string
  vmlimit?:          string
  vmtotal?:          number
}
export interface ListDomainsResponse {
  listdomainsresponse: { count?: number; domain?: Domain[] }
}

// ── Users ────────────────────────────────────────────────
export interface User {
  id:          string
  username:    string
  firstname?:  string
  lastname?:   string
  email?:      string
  account:     string
  accounttype: number
  domain:      string
  domainid:    string
  state:       string
  created:     string
}
export interface ListUsersResponse {
  listusersresponse: { count?: number; user?: User[] }
}

// ── Service Offerings ────────────────────────────────────
export interface ServiceOffering {
  id:                 string
  name:               string
  displaytext?:       string
  cpunumber?:         number
  cpuspeed?:          number
  memory?:            number
  storagetype?:       string
  provisioningtype?:  string
  created?:           string
  issystem?:          boolean
  defaultuse?:        boolean
  iscustomized?:      boolean
}
export interface ListServiceOfferingsResponse {
  listserviceofferingsresponse: { count?: number; serviceoffering?: ServiceOffering[] }
}

// ── Disk Offerings ───────────────────────────────────────
export interface DiskOffering {
  id:            string
  name:          string
  displaytext?:  string
  disksize?:     number
  iscustomized?: boolean
  storagetype?:  string
  created?:      string
}
export interface ListDiskOfferingsResponse {
  listdiskofferingsresponse: { count?: number; diskoffering?: DiskOffering[] }
}

// ── Network Offerings ────────────────────────────────────
export interface NetworkOffering {
  id:            string
  name:          string
  displaytext?:  string
  state:         string
  guestiptype?:  string
  traffictype?:  string
  isdefault?:    boolean
  specifyvlan?:  boolean
  ispersistent?: boolean
  created?:      string
}
export interface ListNetworkOfferingsResponse {
  listnetworkofferingsresponse: { count?: number; networkoffering?: NetworkOffering[] }
}

// ── SSH Key Pairs ────────────────────────────────────────
export interface SSHKeyPair {
  name:        string
  fingerprint: string
  account?:    string
  domain?:     string
  domainid?:   string
}
export interface ListSSHKeyPairsResponse {
  listsshkeypairsresponse: { count?: number; sshkeypair?: SSHKeyPair[] }
}

// ── Security Groups ──────────────────────────────────────
export interface SecurityGroupRule {
  ruleid:      string
  protocol:    string
  startport?:  number
  endport?:    number
  cidr?:       string
}
export interface SecurityGroup {
  id:           string
  name:         string
  description?: string
  account:      string
  domain:       string
  ingressrule?: SecurityGroupRule[]
  egressrule?:  SecurityGroupRule[]
}
export interface ListSecurityGroupsResponse {
  listsecuritygroupsresponse: { count?: number; securitygroup?: SecurityGroup[] }
}

// ── ISOs ─────────────────────────────────────────────────
export interface ISO {
  id:           string
  name:         string
  displaytext?: string
  zonename?:    string
  account?:     string
  bootable?:    boolean
  size?:        number
  created?:     string
  isready?:     boolean
  ispublic?:    boolean
  isfeatured?:  boolean
  status?:      string
}
export interface ListISOsResponse {
  listisosresponse: { count?: number; iso?: ISO[] }
}

// ── Roles ────────────────────────────────────────────────
export interface Role {
  id:           string
  name:         string
  type:         string
  description?: string
}
export interface ListRolesResponse {
  listrolesresponse: { count?: number; role?: Role[] }
}

// ── Projects ─────────────────────────────────────────────
export interface Project {
  id:           string
  name:         string
  displaytext?: string
  state:        string
  account?:     string
  domain?:      string
  domainid?:    string
  vmtotal?:     number
  iptotal?:     number
  volumetotal?: number
}
export interface ListProjectsResponse {
  listprojectsresponse: { count?: number; project?: Project[] }
}

// ── Async Job ────────────────────────────────────────────
export interface AsyncJobResponse {
  jobid: string
}