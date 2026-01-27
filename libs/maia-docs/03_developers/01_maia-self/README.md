# maia-self: Self-Sovereign Identity

## Overview

The `@MaiaOS/self` package provides hardware-backed, zero-storage authentication for MaiaOS using WebAuthn PRF (Pseudo-Random Function). Think of it as your digital identity card that lives in hardware and never stores secrets in the browser.

**What it is:**
- ✅ **Hardware-backed authentication** - Uses Secure Enclave/TPM for secret derivation
- ✅ **Zero secret storage** - All secrets derived on-demand (NO localStorage!)
- ✅ **Deterministic accounts** - Same passkey + salt = same account (always!)
- ✅ **Self-sovereign** - You control your identity, no server-side account database
- ✅ **Cross-device sync** - Passkeys sync via iCloud/Google, accounts via Jazz Cloud

**What it isn't:**
- ❌ **Not password-based** - Uses biometrics (fingerprint/face) only
- ❌ **Not server-dependent** - No server-side account storage required
- ❌ **Not localStorage-dependent** - Zero secrets in browser storage

---

## The Simple Version

Think of `maia-self` like a magic fingerprint scanner:

**Traditional password manager:**
- You remember a master password
- Password unlocks a vault stored in browser storage
- If someone steals the password, they get everything

**MaiaOS with maia-self:**
- Your fingerprint unlocks a hardware chip (Secure Enclave)
- The chip generates secrets on-demand (never stored!)
- Even if someone hacks your browser, there's nothing to steal

**Analogy:**
Imagine two ways to keep your diary safe:

1. **Password-based:** Locked diary with a password you write down
   - If someone finds the password, they read everything
   - If you forget the password, you're locked out forever

2. **MaiaOS (passkey-based):** Magic diary that only opens with your fingerprint
   - No password to steal or forget
   - Only YOUR fingerprint works (can't be tricked)
   - Magic happens in a special chip that hackers can't reach

---

## Architecture

### The Secret Hierarchy

```
┌─────────────────────────────────────────┐
│ Layer 1: PRF Output (32 bytes)         │
│ Source: WebAuthn PRF in Secure Enclave │
│ Storage: NEVER stored, derived on-demand│
└─────────────────────────────────────────┘
              ↓ crypto.agentSecretFromSecretSeed()
┌─────────────────────────────────────────┐
│ Layer 2: AgentSecret                    │
│ Format: "sealerSecret_z.../signer..."   │
│ Storage: NEVER stored, ephemeral         │
└─────────────────────────────────────────┘
              ↓ crypto.getAgentID()
┌─────────────────────────────────────────┐
│ Layer 3: AgentID                        │
│ Format: "sealer_z.../signer_z..."      │
│ Purpose: Public cryptographic identity  │
└─────────────────────────────────────────┘
              ↓ accountHeaderForInitialAgentSecret() + idforHeader()
┌─────────────────────────────────────────┐
│ Layer 4: AccountID (DETERMINISTIC!)     │
│ Format: "co_z..."                       │
│ Storage: Public (can be stored)         │
└─────────────────────────────────────────┘
```

**Key Insight:** AccountID is deterministic! Same passkey + salt → same accountID (always!)

### Storage Architecture

```
┌─────────────────────────────────────────┐
│ Passkey (Hardware-Backed)               │
│ Storage: Secure Enclave / TPM            │
│ Content: Private key (never leaves HW)  │
│ Access: Biometric/PIN required           │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│ IndexedDB (Local Cache)                  │
│ Storage: Browser IndexedDB               │
│ Content: CoValue data (encrypted)        │
│ Purpose: Fast offline access             │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│ Jazz Cloud (Cross-Device Sync)          │
│ Storage: Jazz Cloud server               │
│ Content: CoValue data (end-to-end enc)   │
│ Purpose: Sync across devices             │
└─────────────────────────────────────────┘
```

**Zero Browser Storage:**
- ❌ NO secrets in localStorage
- ❌ NO secrets in sessionStorage
- ❌ NO secrets in IndexedDB (only encrypted CoValue data)
- ✅ Everything derived on-demand from passkey

---

## Documentation Structure

This package documentation is organized into focused topics:

- **[security-analysis.md](./security-analysis.md)** - Overall security analysis and threat model
- **[auth-flows.md](./auth-flows.md)** - Registration and login flows
- **[cryptography.md](./cryptography.md)** - Bottom-up cryptography concepts
- **[api-reference.md](./api-reference.md)** - Complete API reference

---

## Quick Start

### Sign Up (Create New Account)

```javascript
import { signUpWithPasskey } from '@MaiaOS/self';

const { accountID, agentSecret, node, account } = await signUpWithPasskey({
  name: "maia",
  salt: "maia.city"
});

// accountID: "co_z..." (public identifier)
// agentSecret: Ephemeral (never store!)
// node: LocalNode instance (active session)
```

### Sign In (Use Existing Passkey)

```javascript
import { signInWithPasskey } from '@MaiaOS/self';

const { accountID, agentSecret, node, account } = await signInWithPasskey({
  salt: "maia.city"
});

// ⚡ Only 1 biometric prompt!
// Everything computed deterministically from passkey
```

---

## Key Concepts

### Hardware-Backed Secrets

**What it means:**
- PRF evaluation happens in Secure Enclave/TPM (hardware chip)
- Secrets never computed in JavaScript
- Cannot be extracted by XSS attacks or malware

**Why it matters:**
- Even if your browser is compromised, secrets are safe
- Hardware isolation provides stronger security than software-only solutions

### Deterministic Account Recovery

**What it means:**
- Same passkey + same salt → always same accountID
- No random fields in account headers (createdAt: null, uniqueness: null)
- AccountID computed before account creation

**Why it matters:**
- Cross-device recovery without server-side account storage
- No "forgot password" flow needed
- User controls their identity (self-sovereign)

### Zero Browser Storage

**What it means:**
- No secrets stored in localStorage, sessionStorage, or IndexedDB
- All secrets derived on-demand from passkey
- Only public data (accountID) can be stored

**Why it matters:**
- XSS attacks cannot steal secrets (nothing to steal!)
- Device theft mitigated (requires biometric)
- No localStorage compromise risk

---

## Browser Support

### ✅ Supported

- Chrome on macOS, Linux, Windows 11
- Safari on macOS 13+, iOS 16+

### ❌ NOT Supported

- Firefox (all platforms)
- Windows 10 (any browser)
- Old browsers

**The package will throw an error on unsupported browsers with instructions.**

---

## Related Documentation

- [maia-kernel Package](../02_maia-kernel/README.md) - Boot process and orchestration
- [Security Improvements](../architecture/security-improvements.md) - Security analysis
- [Auth Secrets](../architecture/auth-secrets.md) - Secret hierarchy details
- [CoJSON Integration](../architecture/cojson.md) - Database layer

---

## Source Files

**Package:** `libs/maia-self/`

**Key Files:**
- `src/index.js` - Public API exports
- `src/self.js` - Sign up & sign in logic
- `src/prf-evaluator.js` - WebAuthn PRF interface
- `src/feature-detection.js` - PRF support detection
- `src/storage.js` - IndexedDB helper (for CoValue data)
- `src/utils.js` - Encoding/validation utilities

**Dependencies:**
- `cojson` - Core CRDT library
- `cojson-storage-indexeddb` - IndexedDB storage
- `cojson-transport-ws` - WebSocket transport for Jazz Cloud
