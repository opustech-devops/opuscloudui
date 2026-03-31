# OpusCloud Interface — Configuration & Usage Guide

## Quick Start

Access the CloudStack management interface at **http://localhost:3001/cloud** on WSL/Windows network.

### Initial Setup

1. **Open the interface**: Navigate to `http://localhost:3001/cloud`
2. **Configure credentials**: Click the **🔑 Credentials** button in the top-right
3. **Enter your API credentials**:
   - **API Key**: Your CloudStack API key
   - **Secret Key**: Your CloudStack secret key
4. **Click "Save & Test"**

Credentials are automatically saved to browser localStorage and persisted across sessions.

---

## API Credentials

### Where to Get Your Credentials

1. Log in to your CloudStack UI
2. Navigate to **Accounts** → Your Account
3. Click **Generate Keys** (if not already generated)
4. Copy the **API Key** and **Secret Key** (shown only once):
   - API Key: Long alphanumeric string starting with user ID
   - Secret Key: Long base64-encoded string

### Supported Credentials

- **Current Testing**: Using old test credentials (may not work if revoked)
- **New Credentials Provided**: `T7DJzQMOJ_oqwIBFuXxu51s3iGlolpiqnVBASQAVKX1VDQWVqqQJMwN1xyBZQtzBqcc6douhX7FKqcGDlrYZFQ`
  - Secret: `OlqzYuFKfTJzu7kRfLf0rNi4r-Yc6W6cqcVLHmGdFZ182FF9Nr7pmuMj7ifPHcxsnvCMOf3lXPr7Zr7gwqN2KQ`
  - **Status**: HTTP 401 Unauthorized (credentials invalid or revoked)

---

## Dashboard Sections

### 1. **Compute** 💻
- **Instances**: List, start, stop, reboot, destroy VMs
- **Kubernetes**: List K8s clusters deployed on CloudStack
- **SSH Key Pairs**: Manage SSH keys for instance access
- **Security Groups**: Configure firewall rules

### 2. **Storage** 💾
- **Volumes**: Attach/detach volumes to instances
- **Snapshots**: Create, list, restore volume snapshots

### 3. **Network** 🌐
- **Guest Networks**: Manage guest networks and subnets
- **VPCs**: Virtual Private Cloud configuration
- **Public IPs**: Allocate and manage public IPs
- **Routers**: View virtual router status

### 4. **Images** 🖼️
- **Templates**: Pre-configured VM images
- **ISOs**: ISO files for installation

### 5. **Infrastructure** 🏗️
- **Zones**: CloudStack geographic zones
- **Pods**: Pod (cluster) information and capacity
- **Clusters**: Hypervisor clusters (KVM, XenServer, etc.)
- **Hosts**: Physical hosts running VMs
- **Primary Storage**: Storage pools for VM disks
- **Secondary Storage**: Storage for templates and snapshots
- **System VMs**: CloudStack management VMs (Console Proxy, SSVM)
- **Virtual Routers**: Guest routers for network isolation

### 6. **Service Offerings** 📦
- **Compute Offerings**: CPU, memory combinations
- **Disk Offerings**: Storage configurations
- **Network Offerings**: Network service tiers

### 7. **Administration** 🔧
- **Accounts**: User accounts and access control
- **Domains**: Domain hierarchy and partitioning
- **Roles**: RBAC role definitions
- **Projects**: Multi-tenancy grouping

### 8. **Tools** 🛠️
- **Alerts**: System alerts and warnings
- **Resource Limits**: Per-account resource quotas

### 9. **Events** 📋
- Historical log of CloudStack operations

### 10. **API Explorer** 📡
- Browse all available CloudStack API commands
- View parameters and response schemas
- Search for specific commands

---

## Troubleshooting

### ❌ HTTP 401 — Unable to Verify Credentials

**Symptoms**:
- All API calls fail with 401 Unauthorized
- Error: `unable to verify user credentials and/or request signature`
- Dashboard sections show loading then empty

**Causes**:
1. API credentials are invalid or revoked
2. API key doesn't have sufficient permissions
3. HMAC-SHA1 signature miscalculation (fixed in latest version)

**Solutions**:
1. **Regenerate your API keys**:
   - CloudStack UI → Accounts → Generate Keys
   - Copy the new keys and enter them in the credentials modal

2. **Verify permissions**:
   - Your role must have access to CloudStack APIs
   - Ask your CloudStack administrator to check your account permissions

3. **Test with CloudMonkey CLI**:
   ```bash
   cloudmonkey
   set apikey YOUR_API_KEY
   set secretkey YOUR_SECRET_KEY
   list users
   ```

4. **Check CloudStack logs**:
   - CloudStack server logs may show why the signature is invalid
   - Logs are typically in `/var/log/cloudstack/management/`

### ❌ Empty Sections / No Data Loading

**Symptoms**:
- UI loads but all sections are empty
- No loading spinner appears
- Error console shows API failures

**Causes**:
- Credentials not configured
- API keys not set
- Network timeout

**Solutions**:
1. Ensure credentials are configured (green ✓ next to "Credentials")
2. Check browser Network tab for failed API requests
3. Verify CloudStack server is accessible: `curl https://opus1.cloud/client/api`

### ❌ Server Not Responding

**Symptoms**:
- Main page shows blank white screen
- Cannot reach http://localhost:3001

**Causes**:
- Vite server not running
- Port 3001 already in use

**Solutions**:
1. Check if server is running:
   ```bash
   wsl -d Ubuntu-22.04 -- ss -tlnp | grep 3001
   ```

2. Start the server:
   ```bash
   wsl -d Ubuntu-22.04 -- bash -c "cd /root/interface_opuscloud && npx vite preview --host 0.0.0.0 --port 3001"
   ```

3. If port 3001 is in use, kill conflicting process:
   ```bash
   wsl -d Ubuntu-22.04 -- pkill -f "vite preview"
   ```

---

## API Implementation Status

### Core Endpoints (✅ Implemented)

**Compute & Storage**:
- ✅ listVirtualMachines — List all instances
- ✅ listVolumes — List storage volumes
- ✅ listSnapshots — List volume snapshots
- ✅ listKubernetesClusters — List K8s clusters
- ✅ startVirtualMachine — Power on VM
- ✅ stopVirtualMachine — Power off VM
- ✅ rebootVirtualMachine — Restart VM
- ✅ destroyVirtualMachine — Delete VM

**Network**:
- ✅ listNetworks — Guest networks
- ✅ listVpcs — Virtual Private Clouds
- ✅ listPublicIpAddresses — Public IPs
- ✅ listSecurityGroups — Security groups
- ✅ listSSHKeyPairs — SSH keys
- ✅ listRouters — Virtual routers

**Infrastructure**:
- ✅ listZones — Geographic zones
- ✅ listPods — Pod clusters
- ✅ listClusters — Hypervisor clusters
- ✅ listHosts — Physical hosts
- ✅ listStoragePools — Primary & secondary storage
- ✅ listSystemVms — Management VMs
- ✅ listCapacity — Zone capacity overview

**Offerings**:
- ✅ listServiceOfferings — Compute offerings
- ✅ listDiskOfferings — Disk offerings
- ✅ listNetworkOfferings — Network offerings

**Admin**:
- ✅ listAccounts — User accounts
- ✅ listDomains — Domain hierarchy
- ✅ listUsers — User list
- ✅ listRoles — Role definitions
- ✅ listProjects — Multi-tenant projects
- ✅ listResourceLimits — Account quotas

**System**:
- ✅ listEvents — Event log
- ✅ listAlerts — System alerts
- ✅ listApis — API discovery

### Authentication Methods (✅ Complete)

- ✅ **API Key + HMAC-SHA1** — For `/cloud` page (requires credentials)
- ✅ **Session Key** — For logged-in users (DashboardPage)
- ✅ **Dynamic credential configuration** — User can provide own keys

---

## Browser Console Access

For advanced debugging, the CloudStack client is exposed globally:

```javascript
// In browser console (F12 → Console tab):

// Set credentials programmatically
window.cs.setApiCredentials('YOUR_API_KEY', 'YOUR_SECRET_KEY')

// Test a single command
window.cs.listZones().then(r => console.log(r))

// Check current credentials
console.log(window.cs.config)
```

---

## Performance Notes

- Dashboard loads in ~3-4 seconds with 30+ data points
- Capacity bars update on Dashboard load only (cached)
- Search is client-side filtered (instant)
- Large tables (500+ rows) may be slow — use search/filter

---

## Security Considerations

⚠️ **Important**: API credentials are stored in browser localStorage in plaintext!
- ✅ OK for internal networks only
- ❌ NOT recommended for public access
- Use `https://` in production (currently http)
- Consider environment variables or secure vaults for deployment

---

## Keyboard Shortcuts

- **F12**: Open DevTools
- **Ctrl+Shift+I**: Open Inspector (Firefox)
- **Cmd+Option+U**: Source Inspector (Mac)

---

## Support & Logs

- **Vite Server logs**: `/tmp/vite.log` (in WSL)
- **CloudStack logs**: `/var/log/cloudstack/` (on server)
- **Browser console**: F12 → Console tab

---

**Last Updated**: March 31, 2026  
**Interface Version**: 1.0.0  
**CloudStack API**: 4.20.x  
**React**: 18+ | TypeScript: 5+ | Vite: 5.4+
