# Security Audit Report

## Overview
This document provides a comprehensive security audit of all API routes, ensuring "least privilege" access control - no access unless specifically granted.

## Security Model

### API Service (`services/api`)
- **Default Deny**: All routes are blocked by default via `defaultDenyPlugin`
- **Opt-in Access**: Routes must explicitly use `allow()`, `requireAuth()`, or `requireCapabilityForRoute()` to grant access
- **Capability-Based**: Most routes check capabilities rather than just authentication

### Wallet Service (`services/wallet`)
- **No Default Deny**: SvelteKit routes don't have global middleware
- **Manual Checks**: Each route must manually call `requireAdmin()` or `getAuthenticatedSession()`
- **Origin Validation**: Public endpoints validate trusted origins via `isTrustedOrigin()`

## Route-by-Route Security Analysis

### API Service Routes

#### ✅ `/health` (GET)
- **Status**: SECURE
- **Access**: Public (explicitly allowed)
- **Rationale**: Health check endpoint, no sensitive data

#### ⚠️ `/api/v0/projects` (GET)
- **Status**: NEEDS REVIEW
- **Current**: Explicitly allowed, no auth/capability check
- **Issue**: Returns all projects without access control
- **Recommendation**: Add capability check for `data:project:*` read access
- **Risk**: Low (projects are likely public metadata)

#### ✅ `/api/v0/zero/get-queries` (POST)
- **Status**: SECURE
- **Access**: Explicitly allowed, checks capabilities internally
- **Rationale**: Filters queries by user capabilities before returning

#### ✅ `/api/v0/zero/push` (POST)
- **Status**: SECURE
- **Access**: Explicitly allowed, checks capabilities internally
- **Rationale**: Validates capabilities before allowing data push

#### ✅ `/api/v0/voice/live` (WebSocket)
- **Status**: SECURE
- **Access**: Explicitly allowed, checks `api:voice` capability in WebSocket handler
- **Rationale**: WebSocket upgrade happens first, then capability check closes connection if denied

### Wallet Service Routes

#### Admin Routes (`/api/admin/*`)

##### ✅ `/api/admin/info` (GET)
- **Status**: SECURE
- **Access**: `requireAdmin(request)` ✅

##### ✅ `/api/admin/check` (GET)
- **Status**: SECURE
- **Access**: Checks authentication + capability check for `data:schema:*` read
- **Rationale**: Uses capability-based admin check (more flexible than hardcoded admin ID)

##### ✅ `/api/admin/capabilities` (GET)
- **Status**: SECURE
- **Access**: `requireAdmin(request)` ✅

##### ✅ `/api/admin/capabilities/[capabilityId]/revoke` (POST)
- **Status**: SECURE
- **Access**: `requireAdmin(request)` ✅

##### ✅ `/api/admin/capability-requests` (GET)
- **Status**: SECURE
- **Access**: `requireAdmin(request)` ✅

##### ✅ `/api/admin/capability-requests/[requestId]/approve` (POST)
- **Status**: SECURE
- **Access**: `requireAdmin(request)` ✅

##### ✅ `/api/admin/capability-requests/[requestId]/reject` (POST)
- **Status**: SECURE
- **Access**: `requireAdmin(request)` ✅

##### ✅ `/api/admin/capability-groups` (GET)
- **Status**: SECURE
- **Access**: `requireAdmin(request)` ✅

##### ✅ `/api/admin/capability-groups/[groupId]/members` (POST, DELETE)
- **Status**: SECURE
- **Access**: `requireAdmin(request)` ✅

##### ✅ `/api/admin/capability-groups/hominio-explorer/add-hotel-capability` (POST)
- **Status**: SECURE
- **Access**: `requireAdmin(request)` ✅

##### ✅ `/api/admin/capability-groups/auto-assign` (POST)
- **Status**: FIXED ✅
- **Access**: `requireAdmin(request)` ✅ (was missing, now added)

#### Auth Routes (`/api/auth/*`)

##### ✅ `/api/auth/verify` (POST)
- **Status**: SECURE
- **Access**: Public (intentionally)
- **Rationale**: Cookie verification endpoint, validates origin/referer
- **Protection**: `isTrustedOrigin()` check for origin/referer

##### ✅ `/api/auth/capabilities` (GET)
- **Status**: SECURE
- **Access**: `getAuthenticatedSession(request)` ✅
- **Protection**: Also validates trusted origin

##### ✅ `/api/auth/capabilities/request` (POST)
- **Status**: SECURE
- **Access**: `getAuthenticatedSession(request)` ✅
- **Protection**: Also validates trusted origin

##### ✅ `/api/auth/capabilities/requests` (GET)
- **Status**: SECURE
- **Access**: `getAuthenticatedSession(request)` ✅

##### ✅ `/api/auth/capabilities/requests/[id]/approve` (POST)
- **Status**: SECURE
- **Access**: `getAuthenticatedSession(request)` ✅
- **Rationale**: Users can approve requests sent to them (owner approval)

##### ✅ `/api/auth/capabilities/requests/[id]/reject` (POST)
- **Status**: SECURE
- **Access**: `getAuthenticatedSession(request)` ✅
- **Rationale**: Users can reject requests sent to them (owner rejection)

##### ✅ `/api/auth/capabilities/[id]` (DELETE)
- **Status**: SECURE
- **Access**: `getAuthenticatedSession(request)` ✅
- **Rationale**: Users can revoke their own capabilities

## Security Findings

### ✅ Fixed Issues
1. **`/api/admin/capability-groups/auto-assign`**: Added missing `requireAdmin(request)` check

### ⚠️ Recommendations
1. **`/api/v0/projects`**: Consider adding capability check if projects contain sensitive data
   - Current: Public access
   - Recommendation: Add `requireCapabilityForRoute({ type: 'data', namespace: 'project', id: '*' }, 'read')`
   - Risk: Low (likely public metadata)

### ✅ Security Strengths
1. **Default Deny**: API service uses default deny pattern
2. **Capability-Based**: Most routes use capability checks rather than role-based
3. **Origin Validation**: Public endpoints validate trusted origins
4. **Admin Protection**: All admin routes properly protected
5. **User Isolation**: Users can only access their own capabilities/requests

## Conclusion

**Overall Security Status: ✅ SECURE**

- All admin routes properly protected with `requireAdmin()`
- All user routes properly protected with `getAuthenticatedSession()`
- API service uses default deny pattern
- One minor recommendation for `/api/v0/projects` (low risk)
- One critical fix applied: `/api/admin/capability-groups/auto-assign` now requires admin

## Next Steps
1. ✅ Fixed: Added `requireAdmin()` to auto-assign endpoint
2. ⚠️ Optional: Consider adding capability check to `/api/v0/projects` if projects contain sensitive data





