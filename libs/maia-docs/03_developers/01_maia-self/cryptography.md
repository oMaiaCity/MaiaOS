# Bottom-Up Cryptography Concepts

Understanding the cryptographic foundations of `@MaiaOS/self` from first principles.

---

## Overview

This document explains the cryptography used in `@MaiaOS/self` from the ground up, starting with the most fundamental concepts and building to the complete system.

---

## Layer 1: PRF (Pseudo-Random Function)

### What is a PRF?

Think of a PRF like a **magic blender** that takes two ingredients and produces a unique, random-looking output:

```
PRF(passkey, salt) → 32 bytes of random-looking data
```

**Key Properties:**
- **Deterministic:** Same inputs → same output (always!)
- **Random-looking:** Output looks random (can't predict it)
- **One-way:** Can't reverse it (can't get passkey from output)

### WebAuthn PRF Extension

**What it is:**
- Hardware-backed PRF evaluation
- Runs in Secure Enclave/TPM (hardware chip)
- Cannot be extracted by software

**Why it matters:**
- Secrets never computed in JavaScript
- Hardware isolation provides stronger security
- Cannot be stolen by XSS attacks or malware

### PRF Evaluation

```javascript
// Evaluate PRF with existing passkey
const { prfOutput } = await evaluatePRF({
  salt: stringToUint8Array("maia.city")
});

// prfOutput: 32 bytes of deterministic entropy
// Same passkey + same salt → same prfOutput (always!)
```

**What happens:**
1. Browser prompts for biometric (fingerprint/face)
2. Secure Enclave evaluates PRF(passkey, salt)
3. Returns 32-byte output (never leaves hardware during evaluation)
4. Output used to derive secrets

---

## Layer 2: AgentSecret Derivation

### What is AgentSecret?

AgentSecret is the **master key** for your account. It's derived from the PRF output and used to:
- Sign transactions (prove you authorized them)
- Seal data (encrypt for specific groups)
- Derive other secrets

### Derivation Process

```
PRF Output (32 bytes)
    ↓ crypto.agentSecretFromSecretSeed()
AgentSecret
    Format: "sealerSecret_z.../signerSecret_z..."
```

**Code:**
```javascript
const agentSecret = crypto.agentSecretFromSecretSeed(prfOutput);

// agentSecret contains:
// - sealerSecret: For encrypting data
// - signerSecret: For signing transactions
```

**Key Properties:**
- **Deterministic:** Same PRF output → same AgentSecret (always!)
- **Ephemeral:** Never stored, derived on-demand
- **Master key:** Used to derive all other secrets

---

## Layer 3: AgentID Derivation

### What is AgentID?

AgentID is your **public cryptographic identity**. It's derived from AgentSecret and contains:
- Public signing key (for verifying signatures)
- Public sealing key (for encrypting data to you)

### Derivation Process

```
AgentSecret
    ↓ crypto.getAgentID()
AgentID
    Format: "sealer_z.../signer_z..."
```

**Code:**
```javascript
const agentID = crypto.getAgentID(agentSecret);

// agentID contains:
// - sealer: Public encryption key
// - signer: Public signing key
```

**Key Properties:**
- **Public:** Can be shared (it's your identity)
- **Deterministic:** Same AgentSecret → same AgentID (always!)
- **Cryptographic identity:** Used to identify you in transactions

---

## Layer 4: AccountID Derivation

### What is AccountID?

AccountID is your **account identifier**. It's a deterministic hash of the account header, which contains:
- Account type (comap)
- Ruleset (group with you as admin)
- Metadata (account type)
- **NO random fields!** (createdAt: null, uniqueness: null)

### Derivation Process

```
AgentSecret
    ↓ accountHeaderForInitialAgentSecret()
Account Header
    {
      type: "comap",
      ruleset: { type: "group", initialAdmin: agentID },
      meta: { type: "account" },
      createdAt: null,  // ← Not random!
      uniqueness: null  // ← Not random!
    }
    ↓ idforHeader()
AccountID
    Format: "co_z..."
```

**Code:**
```javascript
const accountHeader = accountHeaderForInitialAgentSecret(agentSecret, crypto);
const accountID = idforHeader(accountHeader, crypto);

// accountID: "co_z..." (public identifier)
// Same agentSecret → Same accountID (always!)
```

**Key Properties:**
- **Deterministic:** Same AgentSecret → same AccountID (always!)
- **Public:** Can be shared (it's your account identifier)
- **Computable before creation:** No random fields means we can compute it before creating the account!

---

## The Complete Chain

### From PRF to AccountID

```
┌─────────────────────────────────────────┐
│ Layer 1: PRF Output (32 bytes)         │
│ Source: WebAuthn PRF in Secure Enclave │
│ Storage: NEVER stored                   │
└─────────────────────────────────────────┘
              ↓ crypto.agentSecretFromSecretSeed()
┌─────────────────────────────────────────┐
│ Layer 2: AgentSecret                    │
│ Format: "sealerSecret_z.../signer..."   │
│ Storage: NEVER stored, ephemeral        │
└─────────────────────────────────────────┘
              ↓ crypto.getAgentID()
┌─────────────────────────────────────────┐
│ Layer 3: AgentID                         │
│ Format: "sealer_z.../signer_z..."       │
│ Storage: Public (can be shared)         │
└─────────────────────────────────────────┘
              ↓ accountHeaderForInitialAgentSecret() + idforHeader()
┌─────────────────────────────────────────┐
│ Layer 4: AccountID                       │
│ Format: "co_z..."                        │
│ Storage: Public (can be stored)          │
└─────────────────────────────────────────┘
```

### Deterministic Property

**The key insight:** Every step is deterministic!

```
Same passkey + same salt
    ↓
Same PRF output
    ↓
Same AgentSecret
    ↓
Same AgentID
    ↓
Same Account Header (no random fields!)
    ↓
Same AccountID
```

**Why this matters:**
- Can compute AccountID **before** account creation
- Same passkey + salt → same account (always!)
- Cross-device recovery without storage
- No "forgot password" flow needed

---

## Cryptographic Primitives

### BLAKE3 Hash Function

**What it is:**
- Fast, secure hash function
- Used for deriving secrets from PRF output

**Usage:**
```javascript
// Internal to crypto.agentSecretFromSecretSeed()
const sealerSecret = BLAKE3(prfOutput, context="seal");
const signerSecret = BLAKE3(prfOutput, context="sign");
```

**Properties:**
- **Deterministic:** Same input → same output
- **One-way:** Can't reverse it
- **Fast:** Optimized for performance

---

### Ed25519 Signing

**What it is:**
- Elliptic curve signature scheme
- Used for signing transactions

**Usage:**
```javascript
// Internal to cojson
const signature = ed25519.sign(message, signerSecret);
const isValid = ed25519.verify(message, signature, signerPublicKey);
```

**Properties:**
- **Fast:** Efficient signing and verification
- **Secure:** Based on elliptic curve cryptography
- **Deterministic:** Same message + secret → same signature

---

### X25519 Key Exchange

**What it is:**
- Elliptic curve key exchange
- Used for encrypting data (sealing)

**Usage:**
```javascript
// Internal to cojson
const sharedSecret = x25519.computeSharedSecret(sealerSecret, recipientPublicKey);
const encrypted = encrypt(data, sharedSecret);
```

**Properties:**
- **Fast:** Efficient key exchange
- **Secure:** Based on elliptic curve cryptography
- **Forward secret:** New keys for each encryption

---

## Security Properties

### What Makes It Secure

#### 1. Hardware-Backed Secrets

**PRF evaluation in Secure Enclave/TPM:**
- Secrets never computed in JavaScript
- Hardware isolation protects against software attacks
- Cannot be extracted by XSS or malware

#### 2. Deterministic Derivation

**Same inputs → same outputs:**
- No randomness in account headers
- AccountID computable before creation
- Cross-device recovery without storage

#### 3. Ephemeral Secrets

**Secrets never stored:**
- AgentSecret derived on-demand
- Wiped after use
- Cannot be stolen from storage

#### 4. Zero-Knowledge Sync

**Server cannot decrypt:**
- All data encrypted with user's keys
- Server stores encrypted blobs only
- User controls encryption keys

---

## Attack Resistance

### What Attacks Are Prevented

#### 1. XSS (Cross-Site Scripting)

**Attack:** Malicious code steals secrets from browser storage.

**Prevention:**
- ✅ No secrets in browser storage
- ✅ PRF evaluation in hardware (XSS can't access)
- ✅ Secrets derived on-demand (nothing to steal)

#### 2. Keylogger

**Attack:** Malware records keyboard input to steal password.

**Prevention:**
- ✅ No keyboard input (biometric only)
- ✅ Keylogger cannot capture fingerprint/face
- ✅ PRF evaluation in hardware (keylogger can't see)

#### 3. Memory Dump

**Attack:** Malware reads computer memory to find secrets.

**Prevention:**
- ✅ Secrets cleared immediately after use
- ✅ Ephemeral secrets (derived on-demand)
- ✅ PRF evaluation in hardware (not in RAM)

#### 4. Server Breach

**Attack:** Hackers break into sync server.

**Prevention:**
- ✅ Master secret never stored anywhere
- ✅ Server stores encrypted blobs only
- ✅ User controls encryption keys

---

## Implementation Details

### PRF Evaluation

```javascript
// libs/maia-self/src/prf-evaluator.js

export async function evaluatePRF({ salt, rpId = window.location.hostname }) {
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rpId: rpId,
      userVerification: 'required',
      authenticatorAttachment: 'platform',
      hints: ['client-device'],
      extensions: {
        prf: {
          eval: {
            first: salt, // The salt we want to evaluate
          }
        }
      }
    },
    mediation: 'optional',
  });

  const prfResults = assertion.getClientExtensionResults()?.prf;
  return {
    prfOutput: new Uint8Array(prfResults.results.first),
    credentialId: assertion.rawId,
  };
}
```

### AgentSecret Derivation

```javascript
// Internal to cojson/crypto
export function agentSecretFromSecretSeed(secretSeed: Uint8Array): AgentSecret {
  const sealerSecret = blake3(secretSeed, { context: "seal" });
  const signerSecret = blake3(secretSeed, { context: "sign" });
  
  return {
    sealerSecret: `sealerSecret_z${encode(sealerSecret)}`,
    signerSecret: `signerSecret_z${encode(signerSecret)}`,
  };
}
```

### AccountID Derivation

```javascript
// Internal to cojson
export function accountHeaderForInitialAgentSecret(
  agentSecret: AgentSecret,
  crypto: CryptoProvider
): AccountHeader {
  const agentID = crypto.getAgentID(agentSecret);
  
  return {
    type: "comap",
    ruleset: {
      type: "group",
      initialAdmin: agentID,
    },
    meta: {
      type: "account",
    },
    createdAt: null,  // ← Not random!
    uniqueness: null,  // ← Not random!
  };
}

export function idforHeader(header: AccountHeader, crypto: CryptoProvider): CoID {
  const hash = crypto.shortHash(header);
  return `co_z${encode(hash)}`;
}
```

---

## Related Documentation

- [Main README](./README.md) - Package overview
- [security-analysis.md](./security-analysis.md) - Security analysis
- [auth-flows.md](./auth-flows.md) - Registration and login flows
- [api-reference.md](./api-reference.md) - API reference
