# maia-loader: Core System Services

## Overview

The `@MaiaOS/runtime` package provides the foundational services that power MaiaOS. Think of it as the OS loader - it doesn't do much on its own, but everything else depends on it.

**What it does:**
- ✅ **System Boot** - Initializes the entire OS with engines and modules (`MaiaOS.boot()`)
- ✅ **Unified API** - Exposes a single entry point for all MaiaOS functionality
- ✅ **Re-exports** - Auth, db, factories, vibes seeding helpers, WebSocket peer (services import only from loader)

**What it doesn't do:**
- ❌ Execute MaiaScript (that's `@MaiaOS/runtime`)
- ❌ Store data (that's `@MaiaOS/db`)
- ❌ Validate schemas (that's `@MaiaOS/factories`)

---

## The Simple Version

Think of `maia-loader` like the foundation of a house. Before you can build anything, you need:
1. **Authenticate** - Who are you? (`signInWithPasskey` - proves you're authenticated)
2. **Boot** - Start the system (`MaiaOS.boot()` - starts all the engines with your identity)

**Analogy:**
- `signInWithPasskey` = Getting your ID card (proves who you are)
- `MaiaOS.boot()` = Starting your computer (loads all the programs with your account)

---

## Usage

### Human Mode

```javascript
import { MaiaOS, signInWithPasskey } from '@MaiaOS/runtime';

// Step 1: Authenticate
const { loadingPromise } = await signInWithPasskey({ salt: "maia.city" });
const { node, account } = await loadingPromise;

// Step 2: Boot OS (pass node and account)
const os = await MaiaOS.boot({
  node,
  account,
  modules: ['db', 'core', 'ai']
});

// Now you can:
// - os.createActor() - Create actors
// - os.loadVibe() - Load app manifests from account or by co-id
// - os.do() - Execute data operations (maia.do({ op, factory, key, ... }))
// - os.deliverEvent() - Deliver events to actors
```

### Agent Mode

When `mode === 'agent'` and no peer/node+account, boot uses `AVEN_MAIA_ACCOUNT` and `AVEN_MAIA_SECRET` env vars with `loadOrCreateAgentAccount`.

---

## Documentation Structure

This package documentation is organized into focused topics:

- **[auth-layer.md](./auth-layer.md)** - Identity & Authentication (integrated into boot)
- **[boot-process.md](./boot-process.md)** - Boot process and execution layer
- **[api-reference.md](./api-reference.md)** - Complete API reference
- **[patterns.md](./patterns.md)** - Common patterns and troubleshooting

---

## Quick Start

Here's the complete flow:

```javascript
import { MaiaOS, signInWithPasskey } from '@MaiaOS/runtime';

async function startApp() {
  // STEP 1: Authenticate
  const { loadingPromise } = await signInWithPasskey({ salt: "maia.city" });
  const { node, account } = await loadingPromise;

  // STEP 2: Boot OS
  const os = await MaiaOS.boot({
    node,
    account,
    modules: ['db', 'core', 'ai']
  });

  // STEP 3: Load your app
  const { vibe, actor } = await os.loadVibe(
    'todos',
    document.getElementById('app-container')
  );

  console.log("✅ App loaded:", vibe.name);
}
```

---

## Related Documentation

- [maia-engines Package](../04_maia-engines/README.md) - Execution engines
- [maia-self Package](../01_maia-self/README.md) - Authentication
- [maia-db Package](../05_maia-db/README.md) - Database layer

---

## Source Files

**Package:** `libs/maia-runtime/`

**Key Files:**
- `src/index.js` - Public API exports
- `src/loader.js` - MaiaOS class and boot logic
- `src/cojson-factory.js` - CoJSON API factory

**Dependencies:**
- `@MaiaOS/self` - Authentication
- `@MaiaOS/runtime` - Engines and DSL execution
- `@MaiaOS/db` - Database operations
- `@MaiaOS/factories` - Schema validation
