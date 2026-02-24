# API Reference

Complete API reference for `@MaiaOS/engines` package.

---

## Exported Engines and Runtime

All engines are exported from `@MaiaOS/engines`:

```javascript
import {
  ActorEngine,
  ViewEngine,
  ProcessEngine,
  StyleEngine,
  InboxEngine,
  DataEngine,
  MaiaScriptEvaluator,
  ModuleRegistry,
  Runtime,
} from '@MaiaOS/engines';
```

---

## Subpath Exports

```javascript
// Modules
import { register } from '@MaiaOS/engines/modules/db.module.js';

// Engines (if needed)
import { ActorEngine } from '@MaiaOS/engines/engines/actor.engine.js';
```

---

## Using Engines Directly

### Custom Evaluator

```javascript
import { Evaluator as MaiaScriptEvaluator } from '@MaiaOS/engines';

const evaluator = new MaiaScriptEvaluator();

const result = await evaluator.evaluate(
  { $if: { condition: true, then: 'yes', else: 'no' } },
  { context: {}, item: {} }
);
```

### Custom View Renderer

```javascript
import { ViewEngine, MaiaScriptEvaluator, ModuleRegistry } from '@MaiaOS/engines';

const evaluator = new MaiaScriptEvaluator();
const registry = new ModuleRegistry();
const viewEngine = new ViewEngine(evaluator, null, registry);

await viewEngine.render(viewDef, { context: {} }, shadowRoot, [], 'custom');
```

### Data Operations (maia.do)

```javascript
// maia = booted MaiaOS instance (from MaiaOS.boot())

const store = await maia.do({
  op: 'read',
  schema: 'co_zTodos123'
});

console.log('Current data:', store.value);

const unsubscribe = store.subscribe((data) => {
  console.log('Data updated:', data);
});
```

---

## Package Exports

Defined in `libs/maia-engines/package.json`:

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

- [README.md](./README.md) - Package overview
- [engines/](./engines/) - Detailed engine descriptions
- [modules.md](./modules.md) - Module system
- [expressions.md](./expressions.md) - Expression language
- [patterns.md](./patterns.md) - Common patterns
