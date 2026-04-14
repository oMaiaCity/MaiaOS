# Identity & Authentication Layer

Authentication is integrated into `MaiaOS.boot()`. You provide `node` and `account` (from `signInWithPasskey`) or a pre-initialized `peer`, or use agent mode with env vars.

---

## Overview

**What it is:** Proves who you are and gives you access to your account.

**When to use:** Before booting the OS, you need to authenticate. Pass the result to `MaiaOS.boot()`.

---

## Usage

```javascript
import { MaiaOS, signInWithPasskey } from '@MaiaOS/runtime';

// Step 1: Authenticate (get your ID card)
const { accountID, agentSecret, loadingPromise } = await signInWithPasskey({
  salt: "maia.city"
});

// Step 2: Get node and account (async)
const { node, account } = await loadingPromise;

// Step 3: Boot MaiaOS with node and account
const os = await MaiaOS.boot({ node, account });
```

---

## What You Get

After booting, the MaiaOS instance has:

### `os.id`

Your account identity object containing:
- `maiaId` - Your account (RawAccount)
- `node` - LocalNode instance for CoJSON operations

### `os.peer`

Returns `{ node, account }` for tools that need direct peer access.

### `os.getAllCoValues()`

List all CoValues in your account:

```javascript
const coValues = os.getAllCoValues();
console.log("CoValues:", coValues);
```

---

## Key Concepts

### Identity vs. Execution

**Authentication (signInWithPasskey):**
- **Purpose:** Prove who you are
- **When:** Before booting
- **What it gives:** `accountID`, `agentSecret`, `loadingPromise` → resolve for `node` and `account`
- **Dependencies:** `@MaiaOS/self` (authentication)

**Boot (MaiaOS.boot):**
- **Purpose:** Run your app with your identity
- **When:** After authentication (or with pre-initialized peer)
- **What it gives:** Engines, actors, `os.do()`, vibe loading
- **Dependencies:** `@MaiaOS/runtime`, `@MaiaOS/db`, `@MaiaOS/factories`

---

## Related Documentation

- [Main README](./README.md) - Package overview
- [boot-process.md](./boot-process.md) - Execution layer
- [api-reference.md](./api-reference.md) - Complete API reference
- [patterns.md](./patterns.md) - Common patterns
