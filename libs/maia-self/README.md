# @MaiaOS/self

Self-Sovereign Identity (SSI) via WebAuthn PRF for MaiaOS.

## Overview

This package provides passkey-based authentication with deterministic account derivation using the WebAuthn PRF (Pseudo-Random Function) extension.

**STRICT: PRF is REQUIRED - No fallbacks.**

## Features

- 🔐 **Hardware-backed authentication** - Uses Secure Enclave/TPM
- 🔑 **Deterministic accounts** - Same passkey = same account
- 🚫 **Zero secret storage** - All secrets derived on-demand (NO localStorage!)
- 🔄 **Cross-device sync** - Passkeys sync via iCloud/Google, accounts via self-hosted sync service
- 🎯 **Self-sovereign** - No metadata storage, everything in passkey + self-hosted sync
- ⚡ **Fast login** - Only 1 biometric prompt (no PRF re-evaluation!)

## Browser Support

### ✅ Supported

- Chrome on macOS, Linux, Windows 11
- Safari on macOS 13+, iOS 16+

### ❌ NOT Supported

- Firefox (all platforms)
- Windows 10 (any browser)
- Old browsers

**The package will throw an error on unsupported browsers with instructions.**

## Installation

```bash
bun add @MaiaOS/self
```

## Setup

### 1. Self-Hosted Sync Service (Required)

MaiaOS uses a self-hosted sync service for cross-device account persistence. The sync service URL is determined automatically:

- **Development**: Uses relative path `/sync` (Vite proxy forwards to `localhost:4203`)
- **Production**: Uses `PUBLIC_API_DOMAIN` environment variable or same origin

**Why needed?** Without sync service, accounts can't persist across devices. IndexedDB handles same-browser persistence, sync service enables cross-device sync.

## Usage

### Sign Up (Create New Account)

```javascript
import { signUpWithPasskey } from '@MaiaOS/self';

const { accountID, agentSecret, node, account } = await signUpWithPasskey({
  name: "maia",
  salt: "maia.city"
});

// accountID: "co_z..." (public)
// agentSecret: cojson AgentSecret (ephemeral, never store!)
// node: LocalNode instance (active session)
// account: RawAccount instance (your cojson account)
```

### Sign In (Use Existing Passkey)

```javascript
import { signInWithPasskey } from '@MaiaOS/self';

const { accountID, agentSecret, node, account } = await signInWithPasskey({
  salt: "maia.city"
});

// Loads existing account from sync service
// Returns same structure as signUpWithPasskey
// ⚡ Only 1 biometric prompt (PRF output cached in passkey!)
```

### Sync Status Monitoring

```javascript
import { subscribeSyncState } from '@MaiaOS/self';

const unsubscribe = subscribeSyncState((state) => {
  console.log("Sync status:", state);
  // { connected: true, syncing: true, error: null }
});

// Later: unsubscribe when done
unsubscribe();
```

### Feature Detection

```javascript
import { isPRFSupported } from '@MaiaOS/self';

try {
  await isPRFSupported();
  console.log("PRF supported!");
} catch (error) {
  console.error(error.message); // Instructions for user
}
```

## Security Guarantees

### What's Stored in Passkey (Hardware-Protected)

```
userHandle (inside Secure Enclave/TPM):
  - First 32 bytes: PRF output (derived secret)
  - Remaining bytes: accountID (public, but hardware-protected)
```

### What's Stored NOWHERE (No localStorage!)

- ❌ NO localStorage - Nothing stored in browser!
- ❌ NO IndexedDB - No metadata cached!
- ✅ Everything in passkey (hardware-protected) + sync service (encrypted)

### What's NEVER Stored Anywhere

- `AgentSecret` (derived from PRF output each session)
- `SignerSecret` (derived from AgentSecret)
- `SealerSecret` (derived from AgentSecret)

### Security Properties

- ✅ XSS attack → Gets ZERO data (no localStorage!)
- ✅ Device theft → Needs biometric + passkey
- ✅ localStorage compromise → Nothing to steal!
- ✅ Passkey in hardware → Can't extract, biometric required
- ✅ Cross-device sync → Automatic via iCloud/Google (passkey) + sync service (account)

## How It Works

### Sign Up Flow (2 biometric prompts - unavoidable)

```
Step 1: Create TEMP passkey + evaluate PRF
  → User sees 1st biometric prompt
  → PRF returns 32-byte secret (deterministic!)

Step 2: Create cojson account
  → Derive AgentSecret from PRF output
  → Create account → get accountID (e.g., "co_z...")

Step 3: Create FINAL passkey
  → Concatenate: [PRF_output (32 bytes) || accountID (UTF-8)]
  → Store in userHandle (inside Secure Enclave/TPM)
  → User sees 2nd biometric prompt
  → DONE! Account persists to sync service

Why 2 prompts?
  - Can't know accountID before account is created
  - Can't modify passkey after creation
  - Therefore: temp passkey (derive secret) → final passkey (store secret + ID)
```

### Sign In Flow (1 biometric prompt - FAST! ⚡)

```
Step 1: Get existing passkey
  → User sees biometric prompt
  → Retrieve userHandle from passkey

Step 2: Parse userHandle
  → Extract: first 32 bytes = PRF output (cached!)
  → Extract: remaining bytes = accountID
  → NO PRF re-evaluation needed! (secret already in passkey)

Step 3: Load account
  → Derive AgentSecret from cached PRF output
  → Load account from sync service using accountID
  → DONE! Logged in with 1 prompt!

Why only 1 prompt?
  - PRF output stored in passkey's userHandle
  - accountID also stored in userHandle
  - No need to re-evaluate PRF (we already have the secret!)
```

## API Reference

### `signUpWithPasskey(options)`

Create a new passkey and derive deterministic account.

**Parameters:**
- `options.name` (string, default: "maia") - Display name
- `options.salt` (string, default: "maia.city") - Salt for PRF

**Returns:** `Promise<{accountID: string, agentSecret: Object, node: Object, account: Object, credentialId: string}>`

**Throws:** If PRF not supported

**Note:** Shows 2 biometric prompts (temp passkey + final passkey)

### `signInWithPasskey(options)`

Sign in with existing passkey.

**Parameters:**
- `options.salt` (string, default: "maia.city") - Salt for PRF

**Returns:** `Promise<{accountID: string, agentSecret: Object, node: Object, account: Object, credentialId: string}>`

**Throws:** If PRF not supported or no passkey found

**Note:** Shows only 1 biometric prompt (fast login!)

### `subscribeSyncState(listener)` ⚠️ Moved to `@MaiaOS/db`

**Note:** This function has been moved to `@MaiaOS/db` for better separation of concerns. It's still available via `@MaiaOS/kernel` bundle for convenience.

Subscribe to sync status changes.

**Parameters:**
- `listener` (Function) - Callback: `(state) => void`
  - `state.connected` (boolean) - WebSocket connected?
  - `state.syncing` (boolean) - Actively syncing?
  - `state.error` (string | null) - Error message if any

**Returns:** `Function` - Unsubscribe function

**Example:**
```javascript
import { subscribeSyncState } from '@MaiaOS/kernel'; // or '@MaiaOS/db'

const unsub = subscribeSyncState((state) => {
  console.log("Sync:", state.connected ? "Online" : "Offline");
});
// Later: unsub();
```

### `isPRFSupported()`

Check if WebAuthn PRF is supported (async version).

**Returns:** `Promise<boolean>`

**Throws:** If not supported, with instructions

### `requirePRFSupport()`

Strictly require PRF support (throws on unsupported browsers).

**Returns:** `Promise<void>`

**Throws:** If not supported, with detailed browser upgrade instructions

## Integration Example

```javascript
// In your app initialization
import { signInWithPasskey, signUpWithPasskey, subscribeSyncState } from '@MaiaOS/kernel';
import { MaiaOS } from '@MaiaOS/kernel';

async function init() {
  // Check PRF support first
  await requirePRFSupport();
  
  // Show sign-in UI with both "Sign In" and "Register" buttons
  renderSignInPrompt();
}

async function register() {
  try {
    // Create new account (2 biometric prompts)
    const { node, account, accountID } = await signUpWithPasskey({
      name: "maia",
      salt: "maia.city"
    });
    
    console.log("Registered! Account ID:", accountID);
    
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
    
    console.log("Signed in! Account ID:", accountID);
    
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

## License

MIT
