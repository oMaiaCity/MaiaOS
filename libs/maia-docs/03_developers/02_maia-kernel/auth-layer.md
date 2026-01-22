# Identity & Authentication Layer

The `createMaiaOS` function provides the identity and authentication layer of MaiaOS.

---

## Overview

**What it is:** Proves who you are and gives you access to your account.

**When to use:** Before booting the OS, you need to authenticate.

---

## Usage

```javascript
import { createMaiaOS } from '@MaiaOS/kernel';
import { signInWithPasskey } from '@MaiaOS/self';

// Step 1: Authenticate (get your ID card)
const { node, account, accountID } = await signInWithPasskey({
  salt: "maia.city"
});

// Step 2: Create MaiaOS instance (prove you're authenticated)
const o = await createMaiaOS({ node, account, accountID });
```

---

## What You Get

After calling `createMaiaOS`, you receive an authenticated MaiaOS instance with:

### `o.id`

Your account identity object containing:
- `maiaId` - Your MaiaID (unique identifier)
- `node` - LocalNode instance for CoJSON operations

### `o.auth`

Authentication management API for:
- Managing authentication state
- Signing in/out
- Account management

### `o.inspector()`

Dev tool to inspect your account data:

```javascript
const accountData = o.inspector();
console.log("Account data:", accountData);
```

### `o.getAllCoValues()`

List all CoValues in your account:

```javascript
const coValues = o.getAllCoValues();
console.log("CoValues:", coValues);
```

### `o.getCoValueDetail(coId)`

Get details about a specific CoValue:

```javascript
const detail = o.getCoValueDetail('co_z...');
console.log("CoValue detail:", detail);
```

---

## API Reference

### `createMaiaOS(options)`

Creates an authenticated MaiaOS instance (identity layer).

**Parameters:**
- `options.node` (required) - LocalNode instance from `signInWithPasskey`
- `options.account` (required) - RawAccount instance from `signInWithPasskey`
- `options.accountID` (optional) - Account ID string
- `options.name` (optional) - Display name

**Returns:** `Promise<Object>` - MaiaOS instance with:
- `id` - Identity object (`{ maiaId, node }`)
- `auth` - Authentication API
- `db` - Database API (future)
- `script` - DSL API (future)
- `inspector()` - Dev tool to inspect account
- `getAllCoValues()` - List all CoValues
- `getCoValueDetail(coId)` - Get CoValue details

**Throws:** If `node` or `account` not provided

**Example:**
```javascript
const { node, account } = await signInWithPasskey({ salt: "maia.city" });
const o = await createMaiaOS({ node, account });

// Inspect your account
const accountData = o.inspector();
console.log("Account data:", accountData);

// List all CoValues
const coValues = o.getAllCoValues();
console.log("CoValues:", coValues);
```

---

## Key Concepts

### Identity vs. Execution

**Identity Layer (`createMaiaOS`):**
- **Purpose:** Prove who you are
- **When:** Before booting
- **What it gives:** Access to your account, CoValues, identity
- **Dependencies:** `@MaiaOS/self` (authentication)

**Execution Layer (`MaiaOS.boot()`):**
- **Purpose:** Run your app
- **When:** After authentication
- **What it gives:** Engines, actors, DSL execution
- **Dependencies:** `@MaiaOS/script`, `@MaiaOS/db`, `@MaiaOS/schemata`

---

## Related Documentation

- [Main README](./README.md) - Package overview
- [boot-process.md](./boot-process.md) - Execution layer
- [api-reference.md](./api-reference.md) - Complete API reference
- [patterns.md](./patterns.md) - Common patterns
