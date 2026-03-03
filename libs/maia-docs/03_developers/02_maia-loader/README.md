# maia-loader: Core System Services

## Overview

The `@MaiaOS/loader` package provides the foundational services that power MaiaOS. Think of it as the OS loader - it doesn't do much on its own, but everything else depends on it.

**What it does:**
- ✅ **Identity & Authentication** - Creates authenticated MaiaOS instances (`createMaiaOS`)
- ✅ **System Boot** - Initializes the entire OS with engines and modules (`MaiaOS.boot()`)
- ✅ **Unified API** - Exposes a single entry point for all MaiaOS functionality
- ✅ **Re-exports** - Schemas, tools, vibes seeding helpers, WebSocket peer (services import only from loader)

**What it doesn't do:**
- ❌ Execute MaiaScript (that's `@MaiaOS/engines`)
- ❌ Store data (that's `@MaiaOS/db`)
- ❌ Validate schemas (that's `@MaiaOS/schemata`)

---

## The Simple Version

Think of `maia-loader` like the foundation of a house. Before you can build anything, you need:
1. **Identity** - Who are you? (`createMaiaOS` - proves you're authenticated)
2. **System** - What can you do? (`MaiaOS.boot()` - starts all the engines)

**Analogy:**
- `createMaiaOS` = Getting your ID card (proves who you are)
- `MaiaOS.boot()` = Starting your computer (loads all the programs)

---

## Two Layers, One Package

The loader provides **two distinct layers** that work together:

### Layer 1: Identity & Authentication (`createMaiaOS`)

**What it is:** Proves who you are and gives you access to your account.

**When to use:** Before booting the OS, you need to authenticate.

```javascript
import { createMaiaOS } from '@MaiaOS/loader';
import { signInWithPasskey } from '@MaiaOS/self';

// Step 1: Authenticate (get your ID card)
const { node, account, accountID } = await signInWithPasskey({
  salt: "maia.city"
});

// Step 2: Create MaiaOS instance (prove you're authenticated)
const o = await createMaiaOS({ node, account, accountID });
```

**What you get:**
- `o.id` - Your account identity (MaiaID)
- `o.auth` - Authentication management API
- `o.inspector()` - Dev tool to inspect your account data
- `o.getAllCoValues()` - List all CoValues in your account
- `o.getCoValueDetail(coId)` - Get details about a specific CoValue

### Layer 2: Actor & DSL Execution (`MaiaOS.boot()`)

**What it is:** Starts all the engines that run your actors and execute MaiaScript.

**When to use:** After authentication, boot the OS to run your app.

```javascript
import { MaiaOS } from '@MaiaOS/loader';

// Boot the operating system
const os = await MaiaOS.boot({
  modules: ['db', 'core', 'dragdrop'],
  registry: { /* configs */ }
});

// Now you can:
// - os.createActor() - Create actors
// - os.loadVibe() - Load app manifests
// - os.deliverEvent() - Deliver events to actors
```

**What you get:**
- `os.createActor()` - Create and render actors
- `os.loadVibe()` - Load app manifests from files
- `os.loadVibeFromDatabase()` - Load app manifests from database
- `os.getActor()` - Get actor by ID
- `os.deliverEvent()` - Deliver events to actors
- `os.do()` - Execute data operations (**maia.do({ op, schema, key, ... })**)
- `os.getEngines()` - Access all engines for debugging

---

## Documentation Structure

This package documentation is organized into focused topics:

- **[auth-layer.md](./auth-layer.md)** - Identity & Authentication layer (`createMaiaOS`)
- **[boot-process.md](./boot-process.md)** - Boot process and execution layer (`MaiaOS.boot()`)
- **[api-reference.md](./api-reference.md)** - Complete API reference
- **[patterns.md](./patterns.md)** - Common patterns and troubleshooting

---

## Quick Start

Here's the complete flow:

```javascript
import { createMaiaOS, MaiaOS } from '@MaiaOS/loader';
import { signInWithPasskey } from '@MaiaOS/self';

async function startApp() {
  // STEP 1: Authenticate (Identity Layer)
  const { node, account, accountID } = await signInWithPasskey({
    salt: "maia.city"
  });
  
  const o = await createMaiaOS({ node, account, accountID });
  console.log("✅ Authenticated as:", accountID);
  
  // STEP 2: Boot OS (Execution Layer)
  const os = await MaiaOS.boot({
    modules: ['db', 'core', 'dragdrop']
  });
  
  // STEP 3: Load your app
  const { vibe, actor } = await os.loadVibeFromDatabase(
    '@vibe/todos',
    document.getElementById('app-container')
  );
  
  console.log("✅ App loaded:", vibe.name);
}
```

---

## Related Documentation

- [maia-engines Package](../04_maia-engines/README.md) - Execution engines
- [MaiaOS Architecture](../01_maiaos.md) - Overall system architecture
- [Authentication](../09_authentication.md) - Authentication flow
- [CoJSON Integration](../07_cojson.md) - Database layer

---

## Source Files

**Package:** `libs/maia-loader/`

**Key Files:**
- `src/index.js` - Public API exports
- `src/auth.js` - Identity/authentication layer (`createMaiaOS`)
- `src/loader.js` - Execution layer (`MaiaOS.boot()`)

**Dependencies:**
- `@MaiaOS/self` - Authentication
- `@MaiaOS/engines` - Engines and DSL execution
- `@MaiaOS/db` - Database operations
- `@MaiaOS/schemata` - Schema validation
