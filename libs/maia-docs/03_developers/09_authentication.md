# Authentication with Passkeys (Self-Sovereign Identity)

## Overview

MaiaOS uses **passkey-based authentication** via WebAuthn PRF for self-sovereign identity. This provides:

- 🔐 **Hardware-backed security** - Keys stored in Secure Enclave/TPM
- 🔑 **Deterministic accounts** - Same passkey = same account across devices
- 🚫 **Zero secret storage** - All secrets derived on-demand
- 🔄 **Cross-device sync** - Automatic via iCloud Keychain/Google Password Manager
- 🎯 **Self-sovereign** - No server holds your keys

## Quick Start

### 1. Basic Authentication Flow

```javascript
import { createMaiaOS, signInWithPasskey } from '@MaiaOS/core';

async function init() {
  // Step 1: Sign in with passkey (auto-detects register vs login)
  const { accountID, agentSecret } = await signInWithPasskey({
    salt: "maia.city"  // Default salt
  });
  
  // Step 2: Create MaiaOS with agentSecret
  const o = await createMaiaOS({ 
    agentSecret, 
    name: "Maia" 
  });
  
  console.log("Authenticated as:", accountID);
}
```

### 2. Check Sign-In Status

```javascript
import { isSignedIn, getCurrentAccount } from '@MaiaOS/core';

if (isSignedIn()) {
  const account = getCurrentAccount();
  console.log("Already signed in as:", account.accountID);
  
  // Auto sign-in
  await init();
} else {
  // Show sign-in UI
  showSignInPrompt();
}
```

### 3. Sign Out

```javascript
import { signOut } from '@MaiaOS/core';

function handleSignOut() {
  signOut(); // Clears metadata
  window.location.reload(); // Reset state
}
```

## API Reference

### `signInWithPasskey(options)`

Sign in with existing passkey, or create new if none exists.

**Parameters:**
- `options.salt` (string, default: "maia.city") - Salt for PRF derivation

**Returns:** `Promise<{accountID: string, agentSecret: Object}>`

**Throws:** If PRF not supported or user cancels

**Example:**
```javascript
const { accountID, agentSecret } = await signInWithPasskey({
  salt: "my-custom-salt"
});
```

### `signUpWithPasskey(options)`

Explicitly create a new passkey (usually not needed - `signInWithPasskey` auto-detects).

**Parameters:**
- `options.name` (string, default: "maia") - Display name
- `options.salt` (string, default: "maia.city") - Salt for PRF

**Returns:** `Promise<{accountID: string, agentSecret: Object}>`

**Example:**
```javascript
const { accountID, agentSecret } = await signUpWithPasskey({
  name: "Alice",
  salt: "maia.city"
});
```

### `isSignedIn()`

Check if user has an active session.

**Returns:** `boolean`

**Example:**
```javascript
if (isSignedIn()) {
  console.log("User has active session");
}
```

### `signOut()`

Clear stored metadata (passkey remains in hardware).

**Returns:** `void`

**Example:**
```javascript
signOut();
// Metadata cleared, passkey still in hardware
```

### `getCurrentAccount()`

Get current account metadata.

**Returns:** `{accountID: string, credentialId: string, salt: string} | null`

**Example:**
```javascript
const account = getCurrentAccount();
if (account) {
  console.log("Account ID:", account.accountID);
  console.log("Salt:", account.salt);
}
```

### `isPRFSupported()`

Check if WebAuthn PRF is supported.

**Returns:** `Promise<boolean>`

**Throws:** If not supported, with instructions

**Example:**
```javascript
try {
  await isPRFSupported();
  console.log("PRF supported!");
} catch (error) {
  console.error("Not supported:", error.message);
}
```

### `inspectStorage()` (Debug)

Inspect what's stored in localStorage for debugging.

**Returns:** `{hasAccount: boolean, accountID: string, securityCheck: string, warnings: string[]}`

**Example:**
```javascript
const report = inspectStorage();
console.log("Security check:", report.securityCheck); // "PASSED" or "FAILED"
console.log("Warnings:", report.warnings);
```

## Integration Patterns

### Pattern 1: Simple Auth Wall

```javascript
import { createMaiaOS, signInWithPasskey, isSignedIn } from '@MaiaOS/core';

async function init() {
  if (!isSignedIn()) {
    // Show sign-in button
    document.getElementById("sign-in-btn").style.display = "block";
    return;
  }
  
  // Auto sign-in
  const { agentSecret } = await signInWithPasskey();
  const o = await createMaiaOS({ agentSecret });
  
  renderApp(o);
}

init();
```

### Pattern 2: Silent Authentication

```javascript
async function silentAuth() {
  try {
    if (!isSignedIn()) {
      // No active session
      return null;
    }
    
    const { agentSecret } = await signInWithPasskey();
    return await createMaiaOS({ agentSecret });
  } catch (error) {
    console.error("Silent auth failed:", error);
    return null;
  }
}

const o = await silentAuth();
if (o) {
  renderApp(o);
} else {
  renderSignInPrompt();
}
```

### Pattern 3: Manual Sign-In Button

```javascript
async function handleSignInClick() {
  try {
    const { accountID, agentSecret } = await signInWithPasskey();
    
    console.log("Signed in as:", accountID);
    
    const o = await createMaiaOS({ agentSecret });
    renderApp(o);
  } catch (error) {
    if (error.message.includes("PRF not supported")) {
      alert("Please use Chrome or Safari");
    } else {
      alert("Sign in failed: " + error.message);
    }
  }
}

document.getElementById("sign-in-btn")
  .addEventListener("click", handleSignInClick);
```

## Browser Compatibility

### ✅ Supported Browsers

| Browser | Platform | Min Version | Notes |
|---------|----------|-------------|-------|
| Chrome | macOS | Latest | Full support |
| Chrome | Linux | Latest | Full support |
| Chrome | Windows 11 | Latest | Full support |
| Safari | macOS | 13+ | Best support |
| Safari | iOS | 16+ | Best support |

### ❌ Not Supported

| Browser | Platform | Reason |
|---------|----------|--------|
| Firefox | All | No PRF support |
| Edge | Windows 10 | No PRF support |
| Chrome | Windows 10 | No PRF support |
| Old browsers | All | No WebAuthn PRF |

### Detecting Support

```javascript
import { isPRFSupported } from '@MaiaOS/core';

try {
  await isPRFSupported();
  // Supported!
} catch (error) {
  // Show error page with instructions
  showUnsupportedBrowser(error.message);
}
```

## Security Considerations

### What's Stored

**localStorage only contains PUBLIC data:**
```json
{
  "accountID": "co_z...",       // Public identifier
  "credentialId": "base64...",  // Public passkey reference
  "salt": "maia.city"           // Public salt
}
```

### What's NOT Stored

- ❌ AgentSecret (ephemeral)
- ❌ SignerSecret (ephemeral)
- ❌ SealerSecret (ephemeral)
- ❌ Passkey private key (hardware-only)

### Attack Resistance

| Attack | Protected? | How |
|--------|------------|-----|
| XSS reads localStorage | ✅ Yes | Only public data stored |
| Device theft | ✅ Yes | Needs biometric |
| Phishing | ✅ Yes | No passwords to steal |
| Keylogger | ✅ Yes | Biometric auth only |
| Shoulder surfing | ✅ Yes | No visible secrets |

## Troubleshooting

### Error: "PRF not supported"

**Cause:** Browser doesn't support WebAuthn PRF extension

**Solution:** Use Chrome (macOS/Linux/Win11) or Safari (macOS 13+/iOS 16+)

### Error: "User canceled"

**Cause:** User dismissed biometric prompt

**Solution:** Prompt user to try again

### Error: "AccountID mismatch"

**Cause:** PRF derivation failed or wrong passkey used

**Solution:** Sign out and sign in again

### Error: "SECURITY VIOLATION"

**Cause:** Attempted to store forbidden data

**Solution:** This is a bug - report it

### Passkey Not Found

**Cause:** Passkey not synced to new device yet

**Solution:** Wait for passkey sync (usually instant on Apple, minutes on Google)

## Advanced Topics

### Custom Salt Values

```javascript
// Different apps can use different salts
const { agentSecret } = await signInWithPasskey({
  salt: "myapp.example.com"
});

// Same passkey, different salt = different account
```

### Multi-Account Support

```javascript
// Use different salts for different accounts
const account1 = await signInWithPasskey({ salt: "app1" });
const account2 = await signInWithPasskey({ salt: "app2" });

// Same passkey, different accounts!
```

### Debugging Storage

```javascript
import { inspectStorage } from '@MaiaOS/core';

// In browser console or code:
const report = inspectStorage();
console.log("Security check:", report.securityCheck);

if (report.securityCheck !== "PASSED") {
  console.error("Security issue detected!");
  console.error("Warnings:", report.warnings);
}
```

## Migration Guide

### From Password-Based Auth

**Before:**
```javascript
async function login(username, password) {
  const token = await api.login(username, password);
  localStorage.setItem("token", token);
}
```

**After:**
```javascript
async function login() {
  const { agentSecret } = await signInWithPasskey();
  const o = await createMaiaOS({ agentSecret });
  // No token, no server - self-sovereign!
}
```

### From Server-Stored Secrets

**Before:**
```javascript
async function init() {
  const secret = await api.getAccountSecret(userId);
  const account = await createAccount(secret);
}
```

**After:**
```javascript
async function init() {
  const { agentSecret } = await signInWithPasskey();
  const o = await createMaiaOS({ agentSecret });
  // Secret derived from passkey, never on server
}
```

## Best Practices

1. ✅ **Always check PRF support first**
   ```javascript
   await isPRFSupported(); // Throws if not supported
   ```

2. ✅ **Use default salt unless you need app-specific accounts**
   ```javascript
   await signInWithPasskey({ salt: "maia.city" }); // Default
   ```

3. ✅ **Handle user cancellation gracefully**
   ```javascript
   try {
     await signInWithPasskey();
   } catch (error) {
     if (error.message.includes("cancel")) {
       // User dismissed prompt
     }
   }
   ```

4. ✅ **Show clear error messages**
   ```javascript
   if (error.message.includes("PRF not supported")) {
     showBrowserCompatibilityPage();
   }
   ```

5. ✅ **Never store agentSecret**
   ```javascript
   // ❌ NEVER DO THIS:
   localStorage.setItem("secret", agentSecret);
   
   // ✅ DO THIS:
   // Let it live in memory during session only
   ```

## Further Reading

- [WebAuthn PRF Extension](https://www.w3.org/TR/webauthn-3/#prf-extension)
- [Passkey Best Practices](https://developers.google.com/identity/passkeys)
- [Security Guarantees](../../../libs/maia-self/SECURITY.md)

## See Also

- [MaiaOS Overview](01_maiaos.md)
- [Schemas](03_schemas.md)
- [cojson Architecture](07_cojson.md)
