# Vault Security Guidelines

## Overview

This document defines security requirements for CoJSON encrypted comps used as **password vaults** and **API key vaults**. Follow these guidelines when implementing vault tools and UI.

## Threat Model

- **XSS**: Malicious scripts running in the same origin can read DOM and in-memory data
- **Malicious vibes**: Untrusted JSON configs can configure state machines to call tools; tool abuse could read vault data into context
- **Client compromise**: Malware, compromised device, or physical access with biometric bypass

## Mandatory Requirements

### 1. Never Render Secrets in DOM

| Requirement | Implementation |
|-------------|----------------|
| Vault tools MUST NOT return raw secrets to context | Tools that read vault data return opaque refs or `null`; actual secret used only in secure consumption path |
| Views MUST NOT display vault values | Use `textContent` with masked placeholders (e.g. `••••••••`) or `*` icons; never `$context.vaultPassword` in `text` |
| No `innerHTML` of user/vault data | Already enforced: ViewEngine uses `createElement`, `textContent`, `setAttribute` with sanitization |

### 2. Vault Tool Contract

When implementing `@vault/read` or similar:

```javascript
// WRONG: Returns secret to context (visible in reactive store, could be rendered)
return createSuccessResult({ password: decryptedValue });

// RIGHT: Return opaque handle; secret flows only to secure consumer
return createSuccessResult({ vaultRef: coId, consumedBy: 'copy-to-clipboard' });
// Consumer (e.g. copy action) gets value via internal API, uses it, clears immediately
```

### 3. Schema Isolation for Vaults

- Mark vault schemas with `cotype: 'comap'` and a reserved `$id` pattern (e.g. `@vault/`)
- In tool allowlist for **untrusted vibes**: forbid `@db` read/update on `@vault/*` schemas
- Only dedicated `@vault/*` tools may read vault CoMaps; these tools never return secrets to context

### 4. Transient Memory

- Secrets should exist in memory only for the minimal duration of use (e.g. during `navigator.clipboard.writeText()`)
- Avoid storing decrypted vault values in reactive stores or long-lived variables

### 5. CSP and XSS Mitigation

- Use strict `Content-Security-Policy`: `script-src 'self'`, `object-src 'none'`
- Ensure all rendering uses safe APIs (ViewEngine: `textContent`, `setAttribute` with `sanitizeAttribute`, `containsDangerousHTML` checks)
- Consider Trusted Types for future hardening

## Implementation Checklist

- [ ] Create `@vault/passwords` and `@vault/apiKeys` schemas with `private` CoJSON mode
- [ ] Implement `@vault/read` tool that returns only opaque refs or passes secret to secure consumer
- [ ] Add trust-level check: block `@db` read on `@vault/*` when vibe is untrusted
- [ ] Vault UI components: mask display, copy-to-clipboard with immediate clear
- [ ] Document CSP headers for maia-city and any host app

## References

- [maia-self/SECURITY.md](../../maia-self/SECURITY.md) - Passkey auth, zero secret storage
- [crypto-permissions.md](./crypto-permissions.md) - CoJSON encryption modes
- [self-sovereign-identity.md](./self-sovereign-identity.md) - Layer 3 IndexedDB (no secrets)
