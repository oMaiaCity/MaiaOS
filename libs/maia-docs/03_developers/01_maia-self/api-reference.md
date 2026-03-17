# API Reference

Complete API reference for `@MaiaOS/self` package.

---

## Authentication Functions

### `signUpWithPasskey(options)`

Create a new passkey and derive deterministic account.

**Parameters:**
- `options.name` (string, optional) - Display name; when falsy, fallback is `"Traveler " + randomUUID().slice(0,8)`
- `options.salt` (string, default: `"maia.city"`) - Salt for PRF derivation

**Returns:** `Promise<{accountID: string, agentSecret: Object, loadingPromise: Promise<{node, account}>}>`

**Throws:** If PRF not supported

**Example:**
```javascript
import { signUpWithPasskey } from '@MaiaOS/self';

const { accountID, agentSecret, loadingPromise } = await signUpWithPasskey({
  name: "maia",
  salt: "maia.city"
});

// Resolve node and account (async)
const { node, account } = await loadingPromise;

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

**Returns:** `Promise<{accountID: string, agentSecret: Object, loadingPromise: Promise<{node, account}>}>`

**Throws:** If PRF not supported or no passkey found

**Example:**
```javascript
import { signInWithPasskey } from '@MaiaOS/self';

const { accountID, agentSecret, loadingPromise } = await signInWithPasskey({
  salt: "maia.city"
});

// Resolve node and account (async)
const { node, account } = await loadingPromise;

// Loads existing account from sync server
// ⚡ Only 1 biometric prompt (fast login!)
```

**Note:** Returns immediately; `node` and `account` come from `loadingPromise`. Caller must `await loadingPromise` before using them.

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

## Agent APIs

### `createAgentAccount(options)`

Create a new agent account (for server/headless use).

**Parameters:** `{ agentSecret, accountID?, syncDomain?, dbPath?, inMemory? }`

**Returns:** `Promise<{node, account, accountID}>`

---

### `loadAgentAccount(options)`

Load an existing agent account.

**Parameters:** `{ agentSecret, accountID, syncDomain?, dbPath?, inMemory? }`

**Returns:** `Promise<{node, account}>`

---

### `loadOrCreateAgentAccount(options)`

Load or create an agent account (idempotent).

**Parameters:** `{ accountID, agentSecret, syncDomain?, createName?, ... }`

**Returns:** `Promise<{node, account, accountID}>`

---

### `generateAgentCredentials()`

Generate new agent credentials (for `bun agent:generate`).

**Returns:** `Promise<{accountID, agentSecret}>`

---

## Sync State Monitoring

**Note:** `subscribeSyncState` is **not** exported from `@MaiaOS/self`. Import it from `@MaiaOS/db` or `@MaiaOS/loader`:

```javascript
import { subscribeSyncState } from '@MaiaOS/loader';
// or
import { subscribeSyncState } from '@MaiaOS/db';
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

### `getStorage(options?)`

Get browser storage for CoValue persistence. Uses **OPFS** when available (~4× faster for large data), falls back to **IndexedDB** otherwise (e.g. Firefox private mode, older Safari).

**Parameters:**
- `options.mode` (optional) - `'human'` (browser) or `'agent'` (Node)
- `options.dbPath` (optional) - Path for persistent storage (agent mode)
- `options.inMemory` (optional) - Use in-memory storage (agent mode)

OPFS and IndexedDB use separate storage roots; there is no automatic migration between them. First run with OPFS creates a fresh store.

**Returns:** `Promise<StorageAPI | undefined>` - Storage instance or undefined if unavailable

**Example:**
```javascript
import { getStorage } from '@MaiaOS/self';

const storage = await getStorage({ mode: 'human' });

if (storage) {
  console.log("Storage available (OPFS or IndexedDB)");
} else {
  console.log("Storage unavailable (incognito mode?)");
}
```

---

## Complete Integration Example

```javascript
import { 
  signUpWithPasskey, 
  signInWithPasskey, 
  requirePRFSupport 
} from '@MaiaOS/self';
import { MaiaOS, subscribeSyncState } from '@MaiaOS/loader';

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
    const { accountID, loadingPromise } = await signUpWithPasskey({
      name: "maia",
      salt: "maia.city"
    });
    const { node, account } = await loadingPromise;
    
    console.log("✅ Registered! Account ID:", accountID);
    
    // Subscribe to sync state (from loader, not self)
    subscribeSyncState((state) => {
      console.log("Sync:", state.connected ? "Online" : "Offline");
    });
    
    // Boot MaiaOS with node and account
    const os = await MaiaOS.boot({ node, account });
    
    // Show app UI
    renderApp(os);
  } catch (error) {
    console.error("Registration failed:", error.message);
  }
}

async function signIn() {
  try {
    // Load existing account (1 biometric prompt - fast!)
    const { accountID, loadingPromise } = await signInWithPasskey({
      salt: "maia.city"
    });
    const { node, account } = await loadingPromise;
    
    console.log("✅ Signed in! Account ID:", accountID);
    
    subscribeSyncState((state) => {
      console.log("Sync:", state.connected ? "Online" : "Offline");
    });
    
    const os = await MaiaOS.boot({ node, account });
    
    renderApp(os);
  } catch (error) {
    console.error("Sign in failed:", error.message);
    
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
