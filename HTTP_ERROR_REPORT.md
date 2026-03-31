# HTTP Error Diagnostic Report

**Date:** March 31, 2026  
**Server:** WSL Ubuntu-22.04 @ http://localhost:3001  
**API Credentials:** Updated to new key set

---

## Summary

| Test Case | Status | HTTP Code | Issue |
|-----------|--------|-----------|-------|
| Frontend Pages (/) | ✅ OK | 200 | None |
| Cloud Dashboard (/cloud) | ✅ OK | 200 | None |
| API Proxy (base) | ❌ ERROR | 401 | Invalid credentials |
| listCapacity | ❌ ERROR | 401 | Invalid API Key/Signature |
| listZones | ❌ ERROR | 401 | Invalid API Key/Signature |

---

## Detailed Findings

### 1. Frontend Server Status
- **HTTP 200**: Main page (`/`) — Frontend loads successfully
- **HTTP 200**: Cloud page (`/cloud`) — Dashboard page accessible
- **✅ No errors**: HTML/CSS/JS assets serving correctly

### 2. API Proxy Configuration
- **Proxy status**: Active (vite.config.ts configured for both server and preview)
- **Target**: `https://opus1.cloud/client/api`
- **Route**: `/client/api` → forwards to CloudStack API

### 3. Authentication Errors (HTTP 401)

#### Error Details:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<errorresponse cloud-stack-version="4.20.0.8-scclouds">
  <errorcode>401</errorcode>
  <errortext>unable to verify user credentials and/or request signature</errortext>
</errorresponse>
```

#### Root Cause:
The new API credentials provided are being rejected by the CloudStack API server:

**New Key:** `T7DJzQMOJ_oqwIBFuXxu51s3iGlolpiqnVBASQAVKX1VDQWVqqQJMwN1xyBZQtzBqcc6douhX7FKqcGDlrYZFQ`  
**Response:** ❌ 401 Unauthorized

#### Tested Commands:
- `listCapacity` → 401 Unauthorized
- `listZones` → 401 Unauthorized
- `listAlerts` → 401 Unauthorized (frontend would request)

---

## Test Results

### Test 1: API Without Auth
```bash
curl http://localhost:3001/client/api?command=listCapacity
```
**Response Code:** 401  
**Error:** `unable to verify user credentials and/or request signature`

### Test 2: API With New Credentials
```bash
curl "http://localhost:3001/client/api?command=listCapacity&apiKey=T7DJzQMOJ_oqwIBFuXxu51s3iGlolpiqnVBASQAVKX1VDQWVqqQJMwN1xyBZQtzBqcc6douhX7FKqcGDlrYZFQ&signature=<computed>"
```
**Response Code:** 401  
**Error:** `unable to verify user credentials and/or request signature`

---

## Affected Frontend Features

All dashboard sections that rely on API calls will fail with 401:

1. **Dashboard (capacity bars)** — Won't load capacity data
   - listCapacity → 401
   
2. **Infrastructure panel** — No data
   - listPods, listClusters, listHosts, listStoragePools, etc.
   
3. **All list sections** — Empty with API errors
   - Instances, Volumes, Networks, Accounts, Domains, etc.
   
4. **API Explorer** — listApis will fail
   - API command list won't populate

---

## Possible Issues

1. **Invalid Credentials**: The provided API key/secret may not be active on the CloudStack server
2. **Key Revocation**: Previous credentials (`at4RdQ9...`) may have been rotated out but new ones not activated
3. **HMAC Signature Generation**: Could be generating incorrect signature (though code path unchanged)
4. **API Access Control**: The API key may not have granted permissions to the CloudStack instance

---

## Recommendations

1. ✅ **Verify New Credentials**: Confirm the provided API key/secret are valid and active on `https://opus1.cloud`
2. ✅ **Test with CloudMonkey**: Validate credentials work with CloudStack CLI
3. ✅ **Check Permissions**: Ensure API key has access to required CloudStack APIs
4. ✅ **Fallback Option**: Revert to previous key if new one is not functional

To revert, set credentials in `src/api/cloudstack.ts` line 540-542:
```typescript
export const cloudstackApiKey = new CloudStackClient({
  apiKey:    '***REMOVED_API_KEY***',
  secretKey: '***REMOVED_SECRET_KEY***',
})
```

---

## Server Configuration

- **OS**: Windows 11 with WSL Ubuntu-22.04
- **Node.js**: v20.20.2 (in WSL)
- **Vite**: v5.4.21 (running in preview mode)
- **Port**: 3001
- **Build**: TypeScript + React 18 + Vite SPA
- **API Signing**: HMAC-SHA1 (CryptoJS)
- **Proxy**: Configured for `/client/api` → `https://opus1.cloud/client/api`

---

## Console Output When Accessing /cloud

Expected errors in browser console:
```
Error: Failed to fetch capacity data: HTTP 401 - unable to verify user credentials
Error: Failed to fetch infrastructure data: HTTP 401 - unable to verify user credentials
...
```

The UI will show loading spinners but sections will eventually show empty states once retries exhaust.

---

**Status**: ⚠️ **Credentials Invalid** — Frontend ready, API authentication failing
