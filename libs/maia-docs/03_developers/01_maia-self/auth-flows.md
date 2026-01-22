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
// libs/maia-self/src/oSSI.js

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
// libs/maia-self/src/oSSI.js

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
