# API Reference

Complete API reference for `@MaiaOS/script` package.

---

## Exported Engines

All engines are exported from `@MaiaOS/script`:

```javascript
import {
  ActorEngine,
  ViewEngine,
  StyleEngine,
  StateEngine,
  ToolEngine,
  MaiaScriptEvaluator,
  ModuleRegistry,
  DataEngine,
  IndexedDBBackend,
  SubscriptionEngine,
  MessageQueue
} from '@MaiaOS/script';
```

---

## Subpath Exports

Modules and engines are available via subpath exports:

```javascript
// Modules
import { register } from '@MaiaOS/script/modules/db.module.js';

// Engines (if needed)
import { ActorEngine } from '@MaiaOS/script/engines/actor-engine/actor.engine.js';
```

---

## Using Engines Directly

For advanced use cases, you can use engines independently:

### Custom Evaluator

```javascript
import { MaiaScriptEvaluator } from '@MaiaOS/script';

const evaluator = new MaiaScriptEvaluator(null, {
  maxDepth: 100,
  validateExpressions: true
});

const result = await evaluator.evaluate(
  { $if: { condition: true, then: 'yes', else: 'no' } },
  { context: {}, item: {} }
);
```

### Custom View Renderer

```javascript
import { ViewEngine, MaiaScriptEvaluator, ModuleRegistry } from '@MaiaOS/script';

const evaluator = new MaiaScriptEvaluator();
const registry = new ModuleRegistry();
const viewEngine = new ViewEngine(evaluator, null, registry);

// Render a view without full actor system
await viewEngine.render(viewDef, { context: {} }, shadowRoot, [], 'custom');
```

### Data Operations (maia.do)

```javascript
// maia = booted MaiaOS instance

// Read (always returns reactive store)
const store = await maia.do({
  op: 'read',
  schema: 'co_zTodos123'  // Schema co-id (co_z...)
});

// Store has current value
console.log('Current data:', store.value);

// Subscribe to updates
const unsubscribe = store.subscribe((data) => {
  console.log('Data updated:', data);
});
```

---

## Package Exports

The package exports are defined in `libs/maia-engines/package.json`:

```json
{
  "exports": {
    ".": "./src/index.js",
    "./modules/*": "./src/modules/*",
    "./engines/*": "./src/engines/*"
  }
}
```

---

## Related Documentation

- [Main README](./README.md) - Package overview
- [engines/](./engines/) - Detailed engine descriptions
- [modules.md](./modules.md) - Module system
- [expressions.md](./expressions.md) - Expression language
- [patterns.md](./patterns.md) - Common patterns
