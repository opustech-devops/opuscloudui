// ============================================================
// CloudStack API Types
// ============================================================

// ── Auth ─────────────────────────────────────────────────────

export interface LoginResponse {
  loginresponse: {
    username:   string
    userid:     string
    domainid:   string
    domain:     string
    timeout:    string
    account:    string
    firstname:  string
    lastname:   string
    email:      string
    sessionkey: string
    /** 0 = user, 1 = domain-admin, 2 = root-admin */
    type: string
    registered: string
    errorcode?: number
    errortext?: string
  }
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

// ── Dashboard summary ────────────────────────────────────────

export interface DashboardSummary {
  vms:        { total: number; running: number; stopped: number }
  volumes:    { total: number; totalGb: number }
  networks:   { total: number }
  publicIps:  { total: number }
  snapshots:  { total: number }
}
