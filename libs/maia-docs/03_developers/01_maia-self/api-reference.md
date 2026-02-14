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
import { createMaiaOS } from '@MaiaOS/loader';

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
